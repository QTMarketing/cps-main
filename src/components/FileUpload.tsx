"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileText, 
  Image, 
  X, 
  Download,
  Eye,
  File,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  thumbnail?: string;
  uploadedAt: Date;
  status: 'uploading' | 'uploaded' | 'error';
}

interface FileUploadProps {
  onFilesUploaded?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedTypes?: string[];
  className?: string;
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

export default function FileUpload({
  onFilesUploaded,
  maxFiles = MAX_FILES,
  maxSize = MAX_FILE_SIZE,
  acceptedTypes = Object.keys(ACCEPTED_TYPES),
  className
}: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type === 'application/pdf') return FileText;
    return File;
  };

  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        resolve('');
      }
    });
  };

  const uploadFile = async (file: File): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);
    formData.append('fileType', file.type);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      return {
        id: result.id || Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: result.url,
        thumbnail: await generateThumbnail(file),
        uploadedAt: new Date(),
        status: 'uploaded'
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date(),
        status: 'error'
      };
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      console.error('Rejected files:', rejectedFiles);
      // You could show a toast notification here
    }

    if (acceptedFiles.length === 0) return;

    setIsUploading(true);

    // Add files to state with uploading status
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: Date.now().toString() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date(),
      status: 'uploading'
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Upload files
    const uploadPromises = acceptedFiles.map(async (file, index) => {
      const uploadedFile = await uploadFile(file);
      return { ...uploadedFile, id: newFiles[index].id };
    });

    try {
      const results = await Promise.all(uploadPromises);
      
      setUploadedFiles(prev => 
        prev.map(file => {
          const result = results.find(r => r.name === file.name);
          return result || file;
        })
      );

      if (onFilesUploaded) {
        onFilesUploaded(results.filter(r => r.status === 'uploaded'));
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  }, [onFilesUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize,
    maxFiles: maxFiles - uploadedFiles.length,
    disabled: isUploading || uploadedFiles.length >= maxFiles
  });

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const downloadFile = (file: UploadedFile) => {
    if (file.url) {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      link.click();
    }
  };

  const previewFile = (file: UploadedFile) => {
    if (file.url) {
      window.open(file.url, '_blank');
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Dropzone */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive 
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500",
              (isUploading || uploadedFiles.length >= maxFiles) && "opacity-50 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
                <Upload className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              </div>
              
              {isDragActive ? (
                <div>
                  <p className="text-lg font-medium text-blue-600 dark:text-blue-400">
                    Drop files here...
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Release to upload
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Drag & drop files here
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    or click to browse files
                  </p>
                </div>
              )}
              
              <div className="text-xs text-gray-400 dark:text-gray-500">
                <p>Supported formats: PDF, JPG, PNG, GIF, WebP</p>
                <p>Max file size: {formatFileSize(maxSize)}</p>
                <p>Max files: {maxFiles}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-4">Uploaded Files</h3>
            <div className="space-y-3">
              {uploadedFiles.map((file) => {
                const IconComponent = getFileIcon(file.type);
                const isImage = file.type.startsWith('image/');
                
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {/* Thumbnail or Icon */}
                      {isImage && file.thumbnail ? (
                        <img
                          src={file.thumbnail}
                          alt={file.name}
                          className="w-12 h-12 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded border flex items-center justify-center">
                          <IconComponent className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                        </div>
                      )}
                      
                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {file.name}
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span>{file.type}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Status and Actions */}
                    <div className="flex items-center space-x-2">
                      {/* Status Badge */}
                      <Badge 
                        variant={
                          file.status === 'uploaded' ? 'default' :
                          file.status === 'uploading' ? 'secondary' : 'destructive'
                        }
                        className="text-xs"
                      >
                        {file.status === 'uploading' && (
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                        )}
                        {file.status === 'error' && (
                          <AlertCircle className="w-3 h-3 mr-1" />
                        )}
                        {file.status}
                      </Badge>
                      
                      {/* Action Buttons */}
                      {file.status === 'uploaded' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => previewFile(file)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadFile(file)}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      
                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}