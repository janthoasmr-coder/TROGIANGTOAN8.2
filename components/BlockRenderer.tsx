import React from 'react';
import { BookOpen, Brain, PenTool, CheckCircle, Copy, Calculator, Info, AlertTriangle } from 'lucide-react';
import { BlockContent } from '../types';
import katex from 'katex';

interface BlockRendererProps {
  text: string;
}

const parseBlocks = (text: string): BlockContent[] => {
  const blocks: BlockContent[] = [];
  
  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, '\n');

  // Regex patterns for the separators defined in the prompt
  // Looking for: ━━━━━━━━━━━━━━━━━━━━ \n [ICON] [NUMBER] [TITLE] \n ━━━━━━━━━━━━━━━━━━━━
  
  const sections = normalizedText.split('━━━━━━━━━━━━━━━━━━━━');
  
  // If no sections found (raw text or simple response), return as unknown
  if (sections.length < 2) {
      return [{ type: 'unknown', title: 'Phản hồi', content: normalizedText }];
  }

  // A robust approach is to look for the headers manually
  const headerMap: Record<string, BlockContent['type']> = {
    '1️⃣ KIẾN THỨC SỬ DỤNG': 'knowledge',
    '2️⃣ GỢI Ý BƯỚC GIẢI': 'hint',
    '3️⃣ LỜI GIẢI CHI TIẾT': 'solution',
    '4️⃣ CHỐT PHƯƠNG PHÁP GIẢI': 'summary',
    '5️⃣ BÀI TOÁN TƯƠNG TỰ': 'similar',
    'VẼ HÌNH TRÊN GEOGEBRA': 'geogebra',
    '⚠️ CẢNH BÁO VƯỢT CẤP': 'warning'
  };

  // We will scan the text line by line to build blocks
  const lines = normalizedText.split('\n');
  let currentBlock: BlockContent | null = null;
  let introText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for separators
    if (line.includes('━━━━━━━━━━━━━━━━━━━━')) continue;

    // Check for Headers
    let foundHeader = false;
    for (const [key, type] of Object.entries(headerMap)) {
      if (line.includes(key)) {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          type,
          title: key,
          content: ''
        };
        foundHeader = true;
        break;
      }
    }

    if (foundHeader) continue;

    // If we have a current block, append content
    if (currentBlock) {
      currentBlock.content += lines[i] + '\n';
    } else {
      // Content before the first block (Intro)
      introText += lines[i] + '\n';
    }
  }
  
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // If we found blocks, return them. PREPEND the intro text as a generic block if not empty
  if (blocks.length > 0) {
    if (introText.trim().length > 0) {
      blocks.unshift({ type: 'unknown', title: 'Mở đầu', content: introText });
    }
    return blocks;
  }

  // Fallback: return whole text
  return [{ type: 'unknown', title: '', content: text }];
};

const LatexText: React.FC<{ children: string; className?: string }> = ({ children, className }) => {
  // Split by LaTeX delimiters $...$
  const parts = children.split(/(\$[^$]+\$)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          const formula = part.slice(1, -1);
          try {
            const html = katex.renderToString(formula, {
              throwOnError: false,
              displayMode: false,
            });
            return (
              <span
                key={index}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return <span key={index} className="text-red-500">{part}</span>;
          }
        }
        // Handle bold markdown inside text parts
        const boldParts = part.split(/(\*\*.*?\*\*)/g);
        return (
          <span key={index}>
            {boldParts.map((subPart, subIndex) => {
                if (subPart.startsWith('**') && subPart.endsWith('**')) {
                    return <strong key={subIndex}>{subPart.slice(2, -2)}</strong>;
                }
                return subPart;
            })}
          </span>
        );
      })}
    </span>
  );
};

// Helper to render markdown table
const renderTable = (lines: string[], keyPrefix: string) => {
    const dataRows = lines.filter(line => {
        const trimmed = line.trim();
        const inner = trimmed.replace(/^\||\|$/g, '');
        return !/^[\s\-:|]+$/.test(inner);
    });

    const parsedRows = dataRows.map(line => {
        const cells = line.split('|');
        if (line.trim().startsWith('|')) cells.shift();
        if (line.trim().endsWith('|')) cells.pop();
        return cells;
    });

    if (parsedRows.length === 0) return null;

    return (
        <div key={keyPrefix} className="overflow-x-auto my-3 border border-gray-200 rounded-xl shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
                <tbody className="bg-white divide-y divide-gray-200">
                    {parsedRows.map((row, rIdx) => (
                        <tr key={rIdx} className={rIdx === 0 ? "bg-indigo-50 font-semibold text-indigo-900" : "hover:bg-slate-50/50"}>
                            {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-4 py-3 whitespace-nowrap text-center text-sm border-r last:border-r-0 border-indigo-100 text-gray-700">
                                    <LatexText>{cell.trim()}</LatexText>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const BlockItem: React.FC<{ block: BlockContent }> = ({ block }) => {
  const getStyle = (type: BlockContent['type']) => {
    switch (type) {
      case 'warning': return { 
          bg: 'bg-orange-50/70', 
          border: 'border-orange-300', 
          headerBg: 'bg-orange-100/70',
          text: 'text-orange-900', 
          icon: <AlertTriangle className="w-5 h-5 text-orange-600" /> 
      };
      case 'knowledge': return { 
          bg: 'bg-blue-50/50', 
          border: 'border-blue-200', 
          headerBg: 'bg-blue-100/50',
          text: 'text-blue-900', 
          icon: <BookOpen className="w-5 h-5 text-blue-600" /> 
      };
      case 'hint': return { 
          bg: 'bg-amber-50/50', 
          border: 'border-amber-200', 
          headerBg: 'bg-amber-100/50',
          text: 'text-amber-900', 
          icon: <Brain className="w-5 h-5 text-amber-600" /> 
      };
      case 'solution': return { 
          bg: 'bg-white', 
          border: 'border-indigo-100', 
          headerBg: 'bg-indigo-50/50',
          text: 'text-indigo-900', 
          icon: <PenTool className="w-5 h-5 text-indigo-600" /> 
      };
      case 'summary': return { 
          bg: 'bg-emerald-50/50', 
          border: 'border-emerald-200', 
          headerBg: 'bg-emerald-100/50',
          text: 'text-emerald-900', 
          icon: <CheckCircle className="w-5 h-5 text-emerald-600" /> 
      };
      case 'similar': return { 
          bg: 'bg-purple-50/50', 
          border: 'border-purple-200', 
          headerBg: 'bg-purple-100/50',
          text: 'text-purple-900', 
          icon: <Copy className="w-5 h-5 text-purple-600" /> 
      };
      case 'geogebra': return { 
          bg: 'bg-slate-50/50', 
          border: 'border-slate-300', 
          headerBg: 'bg-slate-200/50',
          text: 'text-slate-800', 
          icon: <Calculator className="w-5 h-5 text-slate-600" /> 
      };
      default: return { 
          bg: 'bg-transparent', 
          border: 'border-transparent', 
          headerBg: 'bg-transparent',
          text: 'text-gray-700', 
          icon: <Info className="w-5 h-5 text-gray-400" /> 
      };
    }
  };

  const style = getStyle(block.type);

  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];
    let isInsideTable = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        const isTableLine = trimmed.startsWith('|') && (trimmed.endsWith('|') || trimmed.includes('|'));
        
        if (isTableLine) {
            isInsideTable = true;
            tableBuffer.push(line);
        } else {
            if (isInsideTable) {
                if (tableBuffer.length > 0) {
                    elements.push(renderTable(tableBuffer, `table-${i}`));
                }
                tableBuffer = [];
                isInsideTable = false;
            }
            
            if (!trimmed) {
                elements.push(<div key={`spacer-${i}`} className="h-2"></div>);
            } else if (trimmed.startsWith('-')) {
                elements.push(<li key={`li-${i}`} className="ml-4 list-disc marker:text-gray-400 pl-1 mb-1"><LatexText>{trimmed.replace(/^-/, '').trim()}</LatexText></li>);
            } else {
                elements.push(<p key={`p-${i}`} className="mb-1"><LatexText>{line}</LatexText></p>);
            }
        }
    }

    if (isInsideTable && tableBuffer.length > 0) {
         elements.push(renderTable(tableBuffer, `table-end`));
    }

    return elements;
  };

  if (block.type === 'unknown') {
    return (
      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">
         {renderContent(block.content)}
      </div>
    );
  }

  return (
    <div className={`mb-5 rounded-xl border ${style.border} ${style.bg} overflow-hidden shadow-sm transition-all hover:shadow-md`}>
      <div className={`px-5 py-3 border-b ${style.border} ${style.headerBg} flex items-center gap-2.5 font-bold tracking-wide ${style.text}`}>
        {style.icon}
        <span>{block.title.replace(/[^\w\s\u00C0-\u1EF9]/g, '').trim()}</span> 
      </div>
      <div className="p-5 text-gray-700 text-[15px] leading-relaxed">
        {renderContent(block.content)}
      </div>
    </div>
  );
};

export const BlockRenderer: React.FC<BlockRendererProps> = ({ text }) => {
  const blocks = parseBlocks(text);

  return (
    <div className="flex flex-col gap-1 w-full">
      {blocks.map((block, index) => (
        <BlockItem key={index} block={block} />
      ))}
    </div>
  );
};