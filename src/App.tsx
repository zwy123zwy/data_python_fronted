import { Outlet, useNavigation } from 'react-router-dom';
import { Spin } from 'antd';
import BaseLayout from './layouts/BaseLayout';

function App() {
  const navigation = useNavigation();
  const isLoading = navigation.state === 'loading';

  return (
    <BaseLayout>
      {isLoading && (
        <Spin
          size="large"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
          }}
        />
      )}
      <Outlet />
    </BaseLayout>
  );
}

export default App;
