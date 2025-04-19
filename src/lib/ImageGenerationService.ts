import { Client } from "@gradio/client";
import { supabase } from '@/lib/supabase';

export interface ImageGenerationOptions {
  prompt: string;
  negative?: string;
  seed?: number;
  randomize_seed?: boolean;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  style?: "anime" | "realistic";
}

export interface BatchImageGenerationResult {
  word: string;
  imageUrl: string;
  error?: string;
}

/**
 * Provides image generation capabilities using Hugging Face models
 */
export class ImageGenerationService {
  private client: Promise<Client>;
  private isLoading = false;
  
  // Fallback images in case the API fails
  private fallbackImages = [
    "https://source.unsplash.com/random/512x512/?ai",
    "https://source.unsplash.com/random/512x512/?digital",
    "https://source.unsplash.com/random/512x512/?art",
    "https://source.unsplash.com/random/512x512/?future",
    "https://source.unsplash.com/random/512x512/?tech",
  ];
  
  /**
   * Creates a new instance of the ImageGenerationService
   * @param modelId The Hugging Face model ID to use
   * @param token Optional Hugging Face access token
   */
  constructor(
    private modelId: string = "black-forest-labs/FLUX.1-schnell", 
    private token: `hf_${string}` = "" as `hf_${string}`
  ) {
    console.log(`Image generation service initialized with ${modelId} model`);
    this.client = Client.connect(this.modelId, {
      hf_token: this.token
    });
  }

  /**
   * Uploads an image to Supabase storage
   * @param imageData The image data (base64 string or blob)
   * @param prompt The prompt used to generate the image
   * @returns Promise resolving to the public URL
   */
  private async uploadImageToSupabase(imageData: string, prompt: string): Promise<string> {
    try {
      let blob: Blob;
      
      // Check if the imageData is a base64 string or a URL
      if (imageData.startsWith('data:')) {
        // It's a base64 string, convert to blob
        const byteString = atob(imageData.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        blob = new Blob([ab], { type: 'image/png' });
      } else {
        // It's a URL, fetch the image data
        const response = await fetch(imageData);
        blob = await response.blob();
      }
      
      // Create a file name for the image
      const fileName = `ai-generated/${prompt.replace(/\s+/g, '-')}-${Date.now()}.png`;
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('vocabulary-images')
        .upload(fileName, blob, {
          contentType: 'image/png',
          cacheControl: '3600',
        });
      
      if (error) {
        console.error('Error uploading AI generated image to Supabase:', error);
        throw error;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('vocabulary-images')
        .getPublicUrl(fileName);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error in uploadImageToSupabase:', error);
      throw error;
    }
  }

  /**
   * Generates an image based on the provided options
   * @param options Image generation options
   * @returns Promise resolving to the image URL
   */
  public async generateImage(options: ImageGenerationOptions): Promise<string> {
    try {
      this.isLoading = true;
      console.log("Generating image with options:", options);
      
      const client = await this.client;
      
      // Prepare prompt with style
      const stylePrefix = options.style === "anime" ? "anime style drawing of " : "";
      const fullPrompt = stylePrefix + options.prompt;
      
      // Construct the array exactly as the Hugging Face documentation shows
      const result = await client.predict(
        "/infer", 
        [
          fullPrompt,
          options.seed || 0,
          options.randomize_seed !== false,
          options.width || 512,
          options.height || 512,
          options.num_inference_steps || 4
        ]
      );
      
      this.isLoading = false;
      
      // The API returns an array with image URL at index 0 and seed at index 1
      console.log("Image generation result:", result.data);
      
      // Get the image URL from the result data
      const imageData = result.data[0];
      const tempImageUrl = imageData?.url || imageData;
      
      // Upload the image to Supabase storage and get a permanent URL
      const permanentUrl = await this.uploadImageToSupabase(tempImageUrl, options.prompt);
      
      return permanentUrl;
    } catch (error) {
      this.isLoading = false;
      console.error("Image generation error:", error);
      
      try {
        // Use fallback images if the API fails
        const randomIndex = Math.floor(Math.random() * this.fallbackImages.length);
        const fallbackImageUrl = this.fallbackImages[randomIndex];
        
        // Still try to store the fallback image in Supabase for consistency
        const permanentUrl = await this.uploadImageToSupabase(
          fallbackImageUrl, 
          `fallback-${options.prompt}`
        );
        
        return permanentUrl;
      } catch (fallbackError) {
        console.error("Fallback image upload error:", fallbackError);
        // As a last resort, return the direct fallback URL
        const randomIndex = Math.floor(Math.random() * this.fallbackImages.length);
        return `${this.fallbackImages[randomIndex]}&prompt=${encodeURIComponent(options.prompt)}`;
      }
    }
  }

  /**
   * Generates images for a batch of words
   * @param wordList List of words to generate images for
   * @param style Image style (anime or realistic)
   * @param width Image width
   * @param height Image height
   * @returns Promise resolving to batch results
   */
  public async generateBatchImages(
    wordList: string[],
    style: "anime" | "realistic" = "anime",
    width: number = 512,
    height: number = 512
  ): Promise<BatchImageGenerationResult[]> {
    const results: BatchImageGenerationResult[] = [];
    
    // Process words sequentially to avoid rate limiting
    for (const word of wordList) {
      try {
        const imageUrl = await this.generateImage({
          prompt: word,
          style,
          width,
          height,
          num_inference_steps: 4
        });
        
        results.push({
          word,
          imageUrl
        });
      } catch (error) {
        console.error(`Error generating image for word "${word}":`, error);
        
        // Use fallback images if the API fails
        try {
          const randomIndex = Math.floor(Math.random() * this.fallbackImages.length);
          const fallbackImageUrl = this.fallbackImages[randomIndex];
          
          // Try to upload the fallback image to Supabase
          const permanentUrl = await this.uploadImageToSupabase(
            fallbackImageUrl, 
            `fallback-${word}`
          );
          
          results.push({
            word,
            imageUrl: permanentUrl,
            error: "Failed to generate image, using fallback"
          });
        } catch (fallbackError) {
          console.error("Fallback image upload error:", fallbackError);
          // As a last resort, return the direct fallback URL
          const randomIndex = Math.floor(Math.random() * this.fallbackImages.length);
          const fallbackUrl = `${this.fallbackImages[randomIndex]}&prompt=${encodeURIComponent(word)}`;
          
          results.push({
            word,
            imageUrl: fallbackUrl,
            error: "Failed to generate and upload image"
          });
        }
      }
    }
    
    return results;
  }

  public isGenerating(): boolean {
    return this.isLoading;
  }
}

export const imageGenerationService = new ImageGenerationService(); 