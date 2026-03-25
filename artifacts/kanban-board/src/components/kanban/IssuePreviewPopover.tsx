import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { MessageSquare, ExternalLink, User, Tag, Clock, RefreshCw } from 'lucide-react';
import { type GitHubIssue } from '@workspace/api-client-react';

interface IssuePreviewPopoverProps {
  issue: GitHubIssue;
  anchorRef: React.RefObject<HTMLElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function getLabelStyle(color: string) {
  return {
    backgroundColor: `#${color}22`,
    color: `#${color}`,
    border: `1px solid #${color}40`,
  };
}

function renderMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (m) => `<pre class="md-pre">${m.replace(/```\w*\n?/g, '').replace(/```/g, '')}</pre>`)
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong class="md-h">$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="md-link">$1</a>')
    .replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '\n\n')
    .replace(/\n/g, '<br/>');
}

export function IssuePreviewPopover({ issue, anchorRef, onMouseEnter, onMouseLeave }: IssuePreviewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;

    let left = rect.right + scrollX + 8;
    let top = rect.top + scrollY - 8;

    // Keep within viewport width
    const popoverWidth = 360;
    if (left + popoverWidth > window.innerWidth + scrollX) {
      left = rect.left + scrollX - popoverWidth - 8;
    }
    if (left < 8) left = 8;

    // Keep within viewport height (approximate popover height 400)
    const popoverHeight = 420;
    if (top + popoverHeight > window.innerHeight + scrollY) {
      top = Math.max(8, window.innerHeight + scrollY - popoverHeight - 8);
    }

    setPosition({ top, left });
  }, [anchorRef]);

  const body = issue.body?.trim();

  return createPortal(
    <div
      ref={popoverRef}
      className="issue-preview-popover"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        width: 360,
        zIndex: 9999,
        background: '#18181b',
        border: '1px solid #3f3f46',
        borderRadius: 6,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        fontSize: 12,
        color: '#d4d4d8',
        maxHeight: 480,
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #27272a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontFamily: 'monospace', color: '#71717a', fontSize: 11 }}>#{issue.number}</span>
          <span style={{
            fontFamily: 'monospace',
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 3,
            background: issue.state === 'open' ? '#052e16' : '#1a1a2e',
            color: issue.state === 'open' ? '#4ade80' : '#818cf8',
            border: `1px solid ${issue.state === 'open' ? '#166534' : '#3730a3'}`,
          }}>
            {issue.state}
          </span>
          <a
            href={issue.html_url}
            target="_blank"
            rel="noreferrer"
            style={{ marginLeft: 'auto', color: '#52525b', textDecoration: 'none' }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#a1a1aa')}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#52525b')}
          >
            <ExternalLink style={{ width: 12, height: 12, display: 'block' }} />
          </a>
        </div>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f4f4f5', lineHeight: 1.4 }}>
          {issue.title}
        </h3>
      </div>

      {/* Meta row */}
      <div style={{
        display: 'flex', gap: 16, padding: '8px 14px',
        borderBottom: '1px solid #27272a', flexWrap: 'wrap',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#71717a', fontFamily: 'monospace' }}>
          <User style={{ width: 11, height: 11 }} />
          {issue.user.login}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#71717a', fontFamily: 'monospace' }}>
          <Clock style={{ width: 11, height: 11 }} />
          {format(new Date(issue.created_at), 'MMM d, yyyy')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#71717a', fontFamily: 'monospace' }}>
          <MessageSquare style={{ width: 11, height: 11 }} />
          {issue.comments} comments
        </span>
        {issue.updated_at !== issue.created_at && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#71717a', fontFamily: 'monospace' }}>
            <RefreshCw style={{ width: 11, height: 11 }} />
            {formatDistanceToNow(new Date(issue.updated_at), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Assignees */}
      {issue.assignees && issue.assignees.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderBottom: '1px solid #27272a' }}>
          {issue.assignees.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <img
                src={a.avatar_url}
                alt={a.login}
                style={{ width: 20, height: 20, borderRadius: '50%' }}
              />
              <span style={{ fontFamily: 'monospace', color: '#a1a1aa', fontSize: 11 }}>{a.login}</span>
            </div>
          ))}
        </div>
      )}

      {/* Labels */}
      {issue.labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 14px', borderBottom: '1px solid #27272a' }}>
          {issue.labels.map((label) => (
            <span
              key={label.id}
              style={{
                ...getLabelStyle(label.color),
                padding: '1px 7px',
                borderRadius: 3,
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Body */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 14px',
        lineHeight: 1.6, color: '#a1a1aa', fontSize: 12,
      }}>
        {body ? (
          <div
            className="preview-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
          />
        ) : (
          <span style={{ color: '#52525b', fontStyle: 'italic' }}>No description provided.</span>
        )}
      </div>
    </div>,
    document.body
  );
}
