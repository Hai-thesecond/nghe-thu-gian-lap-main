import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle, Database } from "lucide-react";
import { toast } from "sonner";
import { supabase } from '@/lib/supabase';
import { checkVocabularyItemsTable, setupVocabularySystem } from '@/lib/supabase';

const VocabularySetup: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(false);
  const [setupInProgress, setSetupInProgress] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Kiểm tra bảng khi component mount
  useEffect(() => {
    const checkTable = async () => {
      try {
        const exists = await checkVocabularyItemsTable();
        setTableExists(exists);
      } catch (error) {
        console.error('Lỗi khi kiểm tra bảng:', error);
        setErrorMessage('Không thể kiểm tra bảng vocabulary_items');
      } finally {
        setLoading(false);
      }
    };
    
    checkTable();
  }, []);
  
  // Xử lý thiết lập bảng
  const handleSetupTable = async () => {
    try {
      setSetupInProgress(true);
      setErrorMessage(null);
      toast.loading('Đang thiết lập hệ thống vocabulary...');
      
      // Gọi hàm thiết lập
      const { success, error } = await setupVocabularySystem();
      
      if (!success) {
        console.error('Lỗi khi thiết lập:', error);
        toast.error('Không thể thiết lập hệ thống vocabulary: ' + error);
        setErrorMessage(error || 'Lỗi không xác định');
        return;
      }
      
      // Kiểm tra lại bảng
      const exists = await checkVocabularyItemsTable();
      setTableExists(exists);
      
      if (exists) {
        toast.success('Đã thiết lập hệ thống vocabulary thành công!');
        setSetupComplete(true);
      } else {
        toast.error('Thiết lập bảng thất bại. Vui lòng liên hệ quản trị viên.');
        setErrorMessage('Bảng vẫn chưa tồn tại sau khi thiết lập');
      }
    } catch (error) {
      console.error('Lỗi khi thiết lập bảng:', error);
      toast.error('Có lỗi xảy ra. Vui lòng thử lại sau.');
      setErrorMessage(error instanceof Error ? error.message : 'Lỗi không xác định');
    } finally {
      setSetupInProgress(false);
    }
  };
  
  // Hiển thị loading
  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>Đang kiểm tra cấu trúc database...</span>
      </div>
    );
  }
  
  // Bảng đã tồn tại
  if (tableExists) {
    return (
      <Alert className="border-green-100 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Đã thiết lập</AlertTitle>
        <AlertDescription className="text-green-700">
          Hệ thống vocabulary đã được thiết lập đúng cách và sẵn sàng sử dụng.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Cần thiết lập bảng
  return (
    <Alert className="border-amber-100 bg-amber-50">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800">Cần thiết lập</AlertTitle>
      <AlertDescription className="text-amber-700">
        <p className="mb-3">
          Hệ thống vocabulary chưa được thiết lập. Bạn cần thiết lập để sử dụng tính năng từ vựng.
        </p>
        
        {errorMessage && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
            {errorMessage}
          </div>
        )}
        
        <Button 
          onClick={handleSetupTable} 
          disabled={setupInProgress}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          {setupInProgress ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Đang thiết lập...</span>
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              <span>Thiết lập hệ thống vocabulary</span>
            </>
          )}
        </Button>
        
        {setupComplete && (
          <p className="mt-3 text-green-600 flex items-center">
            <CheckCircle className="h-4 w-4 mr-1" />
            <span>Thiết lập thành công!</span>
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default VocabularySetup; 