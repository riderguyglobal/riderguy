import 'react-native';
import 'react-native-safe-area-context';

// NativeWind's hoisted type augmentation cannot resolve the workspace-local
// React Native package in this npm monorepo, so keep the styling props local.
declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }

  interface TextProps {
    className?: string;
  }

  interface TextInputProps {
    className?: string;
  }

  interface TouchableWithoutFeedbackProps {
    className?: string;
  }
}

declare module 'react-native-safe-area-context' {
  interface NativeSafeAreaViewProps {
    className?: string;
  }
}
