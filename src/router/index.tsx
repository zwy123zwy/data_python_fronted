import { createBrowserRouter, redirect } from 'react-router-dom';
import { modelConfigService } from '../services/modelConfig';
import App from '../App';

// Lazy-loaded pages
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';

function LazyLoad(importFn: () => Promise<{ default: React.ComponentType }>) {
  const Component = lazy(importFn);
  return (
    <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '100px auto' }} />}>
      <Component />
    </Suspense>
  );
}

// Model readiness loader: redirect to /model-config if models are not ready
async function modelReadyGuard() {
  try {
    const res = await modelConfigService.checkReady();
    const data = res.data.data || {};
    if (!data.chatModelReady && !data.embeddingModelReady) {
      return redirect('/model-config');
    }
    return null;
  } catch {
    // If the check fails (e.g., backend not available), allow navigation
    return null;
  }
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, loader: modelReadyGuard, element: LazyLoad(() => import('../views/AgentList')) },
      { path: 'agents', loader: modelReadyGuard, element: LazyLoad(() => import('../views/AgentList')) },
      { path: 'agent/create', loader: modelReadyGuard, element: LazyLoad(() => import('../views/AgentCreate')) },
      { path: 'agent/:id', loader: modelReadyGuard, element: LazyLoad(() => import('../views/AgentDetail')) },
      { path: 'agent/:id/run', loader: modelReadyGuard, element: LazyLoad(() => import('../views/AgentRun')) },
      { path: 'model-config', element: LazyLoad(() => import('../views/ModelConfig')) },
      { path: '*', element: LazyLoad(() => import('../views/NotFound')) },
    ],
  },
]);
