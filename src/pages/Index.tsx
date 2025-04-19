
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { CheckCircle, Headphones, BarChart2, ShieldCheck } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';

const Index = () => {
  return (
    <MainLayout>
      <div className="space-y-24 my-8">
        {/* Hero Section */}
        <section className="relative py-20">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-lightBlue-50 rounded-3xl -z-10"></div>
          <div className="absolute inset-0 bg-[url('/images/pattern.svg')] opacity-5 -z-10"></div>
          
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center">
              <div className="lg:w-1/2 space-y-6 animate-slide-up">
                <motion.h1 
                  className="text-4xl md:text-5xl font-bold text-gray-900"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  Nâng cao kỹ năng nghe tiếng Anh qua <span className="bg-gradient-to-r from-blue-600 to-lightBlue-500 bg-clip-text text-transparent">Dictation</span>
                </motion.h1>
                <motion.p 
                  className="text-lg text-gray-600 leading-relaxed"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  Nền tảng luyện tập dictation tiếng Anh hiện đại giúp học sinh Việt Nam cải thiện kỹ năng nghe, viết và từ vựng một cách hiệu quả.
                </motion.p>
                <motion.div 
                  className="pt-4 flex flex-wrap gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Link to="/login-student">
                    <Button className="btn-gradient text-lg py-6 px-8">Bắt đầu học ngay</Button>
                  </Link>
                  <Link to="/login-teacher">
                    <Button variant="outline" className="text-lg py-6 px-8">Dành cho giáo viên</Button>
                  </Link>
                </motion.div>
              </div>
              
              <div className="lg:w-1/2 mt-10 lg:mt-0 animate-fade-in">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="relative"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-lightBlue-400 rounded-2xl blur opacity-30"></div>
                  <div className="glass-morphism overflow-hidden relative p-1">
                    <img 
                      src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80" 
                      alt="Students learning English" 
                      className="rounded-xl w-full h-auto"
                    />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Tính năng nổi bật</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Nền tảng của chúng tôi được thiết kế để đáp ứng nhu cầu cả giáo viên và học sinh với nhiều tính năng hữu ích.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <Headphones size={40} className="text-primary" />,
                  title: "Luyện tập linh hoạt",
                  description: "Truy cập và luyện tập các bài dictation mọi lúc, mọi nơi với giao diện thân thiện và dễ sử dụng."
                },
                {
                  icon: <BarChart2 size={40} className="text-primary" />,
                  title: "Phân tích chi tiết",
                  description: "Theo dõi tiến độ học tập với các báo cáo chi tiết về điểm số, lỗi sai và sự tiến bộ theo thời gian."
                },
                {
                  icon: <ShieldCheck size={40} className="text-primary" />,
                  title: "Công nghệ chống gian lận",
                  description: "Hệ thống kiểm soát và giám sát giúp bài kiểm tra diễn ra công bằng và hiệu quả."
                },
              ].map((feature, index) => (
                <Card key={index} className="dashboard-card border-none">
                  <CardContent className="p-6 text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 bg-gradient-to-br from-blue-50 to-lightBlue-50 rounded-3xl">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Cách thức hoạt động</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Quy trình đơn giản để sử dụng nền tảng Dictation của chúng tôi.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Đăng ký tài khoản",
                  description: "Giáo viên và học sinh đăng ký tài khoản với vai trò phù hợp."
                },
                {
                  step: "02",
                  title: "Giáo viên tạo bài tập",
                  description: "Giáo viên tải lên audio và tạo bài tập dictation với các tùy chọn độ khó."
                },
                {
                  step: "03",
                  title: "Học sinh làm bài",
                  description: "Học sinh làm bài tập, nhận phản hồi và theo dõi tiến độ học tập."
                },
              ].map((step, index) => (
                <div key={index} className="relative glass-morphism p-8 h-full">
                  <div className="absolute -top-5 -left-5 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                    {step.step}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mt-4 mb-3">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Người dùng nói gì về chúng tôi</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Phản hồi từ các giáo viên và học sinh đã sử dụng nền tảng Dictation.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  name: "Nguyễn Văn A",
                  role: "Giáo viên tiếng Anh",
                  quote: "Nền tảng này đã giúp tôi tiết kiệm thời gian tạo và chấm bài tập dictation. Các báo cáo phân tích rất hữu ích để theo dõi tiến độ của học sinh."
                },
                {
                  name: "Trần Thị B",
                  role: "Học sinh lớp 10",
                  quote: "Dictation giúp mình cải thiện kỹ năng nghe tiếng Anh rất nhiều. Giao diện dễ sử dụng và các bài tập đa dạng."
                },
                {
                  name: "Lê Văn C",
                  role: "Phụ huynh",
                  quote: "Con tôi đã tiến bộ rõ rệt trong việc nghe và viết tiếng Anh kể từ khi sử dụng nền tảng này. Rất hài lòng với kết quả."
                },
              ].map((testimonial, index) => (
                <Card key={index} className="dashboard-card border-none">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                        </svg>
                      ))}
                    </div>
                    <p className="text-gray-600 italic">"{testimonial.quote}"</p>
                    <div>
                      <p className="font-semibold text-gray-900">{testimonial.name}</p>
                      <p className="text-sm text-gray-500">{testimonial.role}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="glass-morphism p-12 rounded-3xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-lightBlue-500/10"></div>
              <div className="relative z-10 text-center space-y-6 max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Sẵn sàng nâng cao kỹ năng nghe tiếng Anh?</h2>
                <p className="text-lg text-gray-600">
                  Đăng ký ngay hôm nay để bắt đầu hành trình cải thiện kỹ năng nghe và viết tiếng Anh của bạn.
                </p>
                <div className="pt-4 flex justify-center gap-4 flex-wrap">
                  <Link to="/login-student">
                    <Button className="btn-gradient text-lg py-6 px-8">Bắt đầu học ngay</Button>
                  </Link>
                  <Link to="/login-teacher">
                    <Button variant="outline" className="text-lg py-6 px-8">Dành cho giáo viên</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default Index;
