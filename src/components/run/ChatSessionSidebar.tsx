import React, { useEffect, useState, useRef } from 'react';
import { Button, Input, Space, Typography, Popconfirm, message, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, PushpinOutlined, PushpinFilled, MessageOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { chatService } from '../../services/chat';
import type { Agent, ChatSession } from '../../types';

const { Text } = Typography;

interface Props {
  agent: Agent;
  currentSessionId: string;
  onSelectSession: (session: ChatSession) => void;
  onRefreshSessions: () => void;
}

const ChatSessionSidebar: React.FC<Props> = ({ agent, currentSessionId, onSelectSession, onRefreshSessions }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const titleSSERef = useRef<EventSource | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await chatService.getSessions(agent.id);
      const list = (res.data.data || []) as ChatSession[];
      list.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime();
      });
      setSessions(list);
    } catch { /* empty */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSessions(); onRefreshSessions(); }, [agent.id]);

  // SSE for session title updates
  useEffect(() => {
    const url = `/api/agent/${agent.id}/sessions/stream`;
    let reconnectTimer: number;

    const connect = () => {
      const es = new EventSource(url);
      titleSSERef.current = es;

      es.addEventListener('title-updated', (event: Event) => {
        const m = event as MessageEvent;
        try {
          const data = JSON.parse(m.data);
          if (data.sessionId && data.title) {
            setSessions((prev) =>
              prev.map((s) => (s.id === data.sessionId ? { ...s, title: data.title } : s)),
            );
          }
        } catch { /* ignore parse errors */ }
      });

      es.onerror = () => {
        es.close();
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      titleSSERef.current?.close();
      clearTimeout(reconnectTimer);
    };
  }, [agent.id]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await chatService.createSession(agent.id, {
        title: '新对话',
        userId: 1,
      });
      const session = res.data.data as ChatSession;
      if (session) {
        await fetchSessions();
        onSelectSession(session);
      }
    } catch {
      message.error('创建会话失败');
    } finally {
      setCreating(false);
    }
  };

  const handleClearAll = async () => {
    try {
      await chatService.clearSessions(agent.id);
      message.success('全部会话已清空');
      fetchSessions();
    } catch {
      message.error('清空会话失败');
    }
  };

  const handleTogglePin = async (session: ChatSession) => {
    try {
      await chatService.togglePin(session.id, !session.isPinned);
      fetchSessions();
    } catch { message.error('操作失败'); }
  };

  const handleRename = async (sessionId: string) => {
    if (!editTitle.trim()) return;
    try {
      await chatService.renameSession(sessionId, editTitle);
      setEditingId(null);
      fetchSessions();
    } catch { message.error('重命名失败'); }
  };

  const handleDelete = async (sessionId: string) => {
    try {
      await chatService.deleteSession(sessionId);
      if (sessionId === currentSessionId) {
        onSelectSession({ id: '', agentId: agent.id, title: '', isPinned: false, userId: 0, createTime: '', updateTime: '' } as ChatSession);
      }
      fetchSessions();
    } catch { message.error('删除失败'); }
  };

  return (
    <div
      style={{
        width: collapsed ? 48 : 260,
        transition: 'width 0.3s',
        borderRight: '1px solid #f0f0f0',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#fafafa',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button
          type="text"
          size="small"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed(!collapsed)}
        />
        {!collapsed && (
          <Text strong style={{ flex: 1, fontSize: 14 }}>会话列表</Text>
        )}
      </div>

      {!collapsed && (
        <>
          <div style={{ padding: '8px 12px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" icon={<PlusOutlined />} block onClick={handleCreate} loading={creating}>
                新建会话
              </Button>
              {sessions.length > 0 && (
                <Popconfirm title="确定清空全部会话？" onConfirm={handleClearAll}>
                  <Button danger size="small" block>清空全部</Button>
                </Popconfirm>
              )}
            </Space>
          </div>

          {/* Session list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: 6,
                  marginBottom: 4,
                  background: session.id === currentSessionId ? '#e6f4ff' : 'transparent',
                  border: session.id === currentSessionId ? '1px solid #91caff' : '1px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MessageOutlined style={{ fontSize: 12, color: '#999', flexShrink: 0 }} />
                  {editingId === session.id ? (
                    <Input
                      size="small"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onPressEnter={() => handleRename(session.id)}
                      onBlur={() => handleRename(session.id)}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      style={{ flex: 1 }}
                    />
                  ) : (
                    <Text
                      ellipsis
                      style={{ flex: 1, fontSize: 13 }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingId(session.id);
                        setEditTitle(session.title);
                      }}
                    >
                      {session.title || '新对话'}
                    </Text>
                  )}
                  {session.isPinned && <PushpinFilled style={{ fontSize: 10, color: '#faad14' }} />}
                </div>
                {session.id !== editingId && (
                  <Space size={4} style={{ marginTop: 4, justifyContent: 'flex-end', width: '100%' }}>
                    <Tooltip title="置顶">
                      <Button
                        type="text" size="small"
                        icon={session.isPinned ? <PushpinFilled /> : <PushpinOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleTogglePin(session); }}
                      />
                    </Tooltip>
                    <Tooltip title="重命名">
                      <Button
                        type="text" size="small" icon={<EditOutlined />}
                        onClick={(e) => { e.stopPropagation(); setEditingId(session.id); setEditTitle(session.title); }}
                      />
                    </Tooltip>
                    <Popconfirm title="确定删除？" onConfirm={(e) => { e?.stopPropagation(); handleDelete(session.id); }}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                    </Popconfirm>
                  </Space>
                )}
              </div>
            ))}
            {!loading && sessions.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#999', fontSize: 12 }}>
                暂无会话
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ChatSessionSidebar;
