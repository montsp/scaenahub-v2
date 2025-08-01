import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  content,
  className = '',
}) => {
  // Process mentions in the content
  const processedContent = content.replace(
    /@(\w+)/g,
    '<span class="mention">@$1</span>'
  );

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom styling for markdown elements
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
          del: ({ children }) => <del className="line-through text-gray-600">{children}</del>,
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded text-sm font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block p-3 bg-gray-100 text-gray-800 rounded-lg text-sm font-mono overflow-x-auto">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-gray-100 rounded-lg p-3 overflow-x-auto mb-2">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 py-2 bg-gray-50 rounded-r-lg mb-2">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-gray-800">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {children}
            </a>
          ),
          h1: ({ children }) => <h1 className="text-xl font-bold mb-2 text-gray-900">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mb-2 text-gray-900">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mb-2 text-gray-900">{children}</h3>,
          hr: () => <hr className="border-gray-300 my-3" />,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full border border-gray-300 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-medium text-gray-900 border-r border-gray-300 last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-gray-800 border-r border-gray-300 last:border-r-0">
              {children}
            </td>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
      
      <style dangerouslySetInnerHTML={{
        __html: `
          .markdown-content .mention {
            background-color: #dbeafe;
            color: #1d4ed8;
            padding: 0.125rem 0.375rem;
            border-radius: 0.25rem;
            font-weight: 500;
          }
        `
      }} />
    </div>
  );
};

export default MarkdownMessage;