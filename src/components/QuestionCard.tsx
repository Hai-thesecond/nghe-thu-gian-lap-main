import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Clock, Play, ExternalLink } from 'lucide-react';

interface QuestionCardProps {
  id: string;
  title: string;
  teacherName?: string;
  difficulty: string;
  timeLimit: number;
  completed: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  id,
  title,
  teacherName,
  difficulty,
  timeLimit,
  completed
}) => {
  const getDifficultyColor = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
      case 'dễ':
        return 'bg-green-100 text-green-800';
      case 'medium':
      case 'trung bình':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
      case 'khó':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyText = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case 'easy': return 'Dễ';
      case 'medium': return 'Trung bình';
      case 'hard': return 'Khó';
      default: return diff || 'Không xác định';
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg truncate">{title}</CardTitle>
          <Badge className={getDifficultyColor(difficulty)}>
            {getDifficultyText(difficulty)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-2">
          {teacherName && (
            <div className="text-sm text-gray-500">
              Giáo viên: <span className="font-medium">{teacherName}</span>
            </div>
          )}
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-1" />
            <span>Thời gian: {timeLimit} phút</span>
          </div>
          <div className="text-sm text-gray-500">
            Trạng thái: <Badge variant={completed ? "secondary" : "outline"}>
              {completed ? 'Đã hoàn thành' : 'Chưa làm'}
            </Badge>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        {completed ? (
          <div className="w-full flex flex-col gap-2">
            <Link to={`/student/question/${id}`} className="w-full">
              <Button className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Làm lại
              </Button>
            </Link>
            <Link to={`/student/result/${id}`} className="w-full">
              <Button variant="outline" className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                Xem kết quả
              </Button>
            </Link>
          </div>
        ) : (
          <Link to={`/student/question/${id}`} className="w-full">
            <Button className="w-full">
              <Play className="h-4 w-4 mr-2" />
              Làm bài
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
};

export default QuestionCard; 