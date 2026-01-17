import React, { useState, useRef, useEffect } from 'react';
import { Send, Eraser, Calculator, Sparkles, Image as ImageIcon, X } from 'lucide-react';
import { Message, Role } from '../types';
import { sendMessageStream } from '../services/geminiService';
import { BlockRenderer } from './BlockRenderer';

export const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: Role.MODEL,
      text: '📐 Xin chào! Thầy là trợ lý học tập Toán 8.\n\nEm cần hỗ trợ bài toán nào hôm nay? (Đại số, Hình học...)\nEm có thể dán ảnh bài tập vào đây để thầy xem nhé!',
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Image handling state
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // Data URL for preview
  const [imageInlineData, setImageInlineData] = useState<{data: string, mimeType: string} | null>(null); // For API
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Check if the last message is from the model and is currently streaming
    const lastMessage = messages[messages.length - 1];
    const isStreaming = lastMessage?.role === Role.MODEL && lastMessage?.isStreaming;

    // If streaming, use 'auto' (instant) scroll to keep up with text generation.
    // Otherwise use 'smooth' for better UX on new message arrival.
    messagesEndRef.current?.scrollIntoView({ 
        behavior: isStreaming ? 'auto' : 'smooth',
        block: 'end'
    });
  };

  // Update dependency to [messages] instead of [messages.length]
  // This ensures scroll triggers when content updates (streaming), not just when new messages are added.
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onloadend = () => {
        const result = reader.result as string;
        setSelectedImage(result);
        
        // Extract base64 data and mime type for API
        // result looks like: "data:image/png;base64,iVBORw0KGgo..."
        const base64Data = result.split(',')[1];
        setImageInlineData({
            data: base64Data,
            mimeType: file.type
        });
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
        if (item.type.indexOf('image') === 0) {
            const file = item.getAsFile();
            if (file) {
                processFile(file);
                e.preventDefault(); 
            }
        }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        processFile(e.target.files[0]);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
      setSelectedImage(null);
      setImageInlineData(null);
  };

  const handleSend = async () => {
    if ((!input.trim() && !imageInlineData) || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: input,
      timestamp: new Date(),
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const currentImageInlineData = imageInlineData; // Capture current image data
    
    // Clear image state
    setSelectedImage(null);
    setImageInlineData(null);
    
    setIsLoading(true);

    try {
      const stream = sendMessageStream(
          input, 
          messages, // Pass current history so geminiService can restore session if needed
          currentImageInlineData ? { inlineData: currentImageInlineData } : undefined
      );
      
      let responseText = '';
      const aiMsgId = (Date.now() + 1).toString();
      
      setMessages(prev => [
        ...prev,
        {
          id: aiMsgId,
          role: Role.MODEL,
          text: '',
          timestamp: new Date(),
          isStreaming: true
        }
      ]);

      for await (const chunk of stream) {
        responseText += chunk;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === aiMsgId 
              ? { ...msg, text: responseText } 
              : msg
          )
        );
      }

      setMessages(prev => 
        prev.map(msg => 
          msg.id === aiMsgId 
            ? { ...msg, isStreaming: false } 
            : msg
        )
      );

    } catch (error: any) {
      console.error("Error sending message:", error);
      
      let errorMessage = "Xin lỗi, đã có lỗi xảy ra. Vui lòng kiểm tra kết nối hoặc thử lại sau.";
      
      // Check for specific API Key errors
      if (error instanceof Error && (error.message.includes("API Key") || error.message.includes("API_KEY"))) {
        errorMessage = "⚠️ **Lỗi Cấu Hình**: Chưa tìm thấy API Key.\n\nVui lòng đảm bảo bạn đã thiết lập biến môi trường `API_KEY`.";
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: Role.MODEL,
          text: errorMessage,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 relative font-sans">
      {/* Colorful Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between shadow-lg z-10 sticky top-0">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white shadow-inner border border-white/10">
                <Calculator size={24} />
            </div>
            <div>
                <h1 className="font-bold text-white text-lg tracking-wide flex items-center gap-2">
                  Toán 8 
                  <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full backdrop-blur-sm font-medium border border-white/10">Chân Trời Sáng Tạo</span>
                </h1>
                <p className="text-xs text-blue-100/90 font-medium flex items-center gap-1">
                  <Sparkles size={12} /> Trợ lý AI thông minh
                </p>
            </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setMessages([messages[0]])}
                className="p-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-full transition-all"
                title="Xóa đoạn chat"
            >
                <Eraser size={20} />
            </button>
            <a 
                href="https://www.geogebra.org/classic" 
                target="_blank" 
                rel="noreferrer"
                className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-white/10 text-white text-sm font-semibold rounded-full hover:bg-white/20 transition-all border border-white/10 backdrop-blur-sm"
            >
                <Calculator size={16} />
                GeoGebra
            </a>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scrollbar-hide bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${
              msg.role === Role.USER ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* Avatar for Bot */}
            {msg.role === Role.MODEL && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 mr-3 flex items-center justify-center text-white shadow-md self-start mt-2">
                <Sparkles size={16} />
              </div>
            )}

            <div
              className={`max-w-[90%] md:max-w-[80%] lg:max-w-[70%] flex flex-col ${
                msg.role === Role.USER ? 'items-end' : 'items-start'
              }`}
            >
              {/* Image in message */}
              {msg.image && (
                  <div className={`mb-2 rounded-xl overflow-hidden shadow-sm border-4 ${
                      msg.role === Role.USER ? 'border-blue-500/30' : 'border-white'
                  }`}>
                      <img src={msg.image} alt="User uploaded" className="max-w-[200px] md:max-w-[300px] max-h-[300px] object-cover" />
                  </div>
              )}

              <div className={`rounded-2xl p-5 shadow-sm transition-all ${
                msg.role === Role.USER
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-tr-sm shadow-blue-200'
                  : 'bg-white border border-indigo-50/50 rounded-tl-sm shadow-indigo-100'
              }`}>
                {msg.role === Role.USER ? (
                  <div className="whitespace-pre-wrap font-medium leading-relaxed">{msg.text}</div>
                ) : (
                  <BlockRenderer text={msg.text} />
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Loading Indicator */}
        {isLoading && messages[messages.length - 1]?.role !== Role.MODEL && (
            <div className="flex justify-start w-full">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 mr-3 flex items-center justify-center text-white shadow-md">
                   <Sparkles size={16} />
                </div>
                <div className="bg-white border border-indigo-50 rounded-2xl rounded-tl-sm p-4 shadow-sm flex items-center gap-2">
                     <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                     <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                     <div className="w-2.5 h-2.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 z-10 sticky bottom-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-8">
        
        {/* Image Preview */}
        {selectedImage && (
            <div className="max-w-4xl mx-auto mb-2 flex">
                <div className="relative group">
                    <img 
                        src={selectedImage} 
                        alt="Selected preview" 
                        className="h-20 w-auto rounded-lg shadow-md border-2 border-indigo-200"
                    />
                    <button 
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        )}

        <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-white border border-indigo-100 rounded-2xl p-2 focus-within:ring-4 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all shadow-xl shadow-indigo-100/50">
          <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
          />
          <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl mb-0.5 transition-colors"
              title="Gửi ảnh"
          >
              <ImageIcon size={20} />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={selectedImage ? "Thêm ghi chú cho ảnh..." : "Nhập bài toán (có thể dán ảnh) ..."}
            className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 px-1 text-gray-700 placeholder-gray-400 font-medium"
            rows={1}
            style={{ height: 'auto', minHeight: '44px' }}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !selectedImage) || isLoading}
            className={`p-3 rounded-xl mb-0.5 transition-all duration-300 ${
              (input.trim() || selectedImage) && !isLoading
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200 hover:shadow-blue-300 transform hover:-translate-y-0.5'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send size={20} strokeWidth={2.5} />
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-3 font-medium">
          AI hỗ trợ học tập - Hãy kiểm tra lại kết quả quan trọng.
        </p>
      </div>
    </div>
  );
};