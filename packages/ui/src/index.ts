// Utility
export { cn } from './lib/utils';

// Components
export { Button, buttonVariants, type ButtonProps } from './components/button';
export { Input, type InputProps } from './components/input';
export { Textarea, type TextareaProps } from './components/textarea';
export { Label } from './components/label';
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './components/card';
export { Badge, badgeVariants, type BadgeProps } from './components/badge';
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/dialog';
export { Separator } from './components/separator';
export { Avatar, AvatarImage, AvatarFallback } from './components/avatar';
export { Switch } from './components/switch';
export { Checkbox } from './components/checkbox';
export { Skeleton } from './components/skeleton';
export { Spinner } from './components/spinner';
export {
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from './components/toast';

// Sprint 2 — Auth / Onboarding components
export {
  OtpInput,
  type OtpInputProps,
  type OtpInputHandle,
} from './components/otp-input';
export {
  StepIndicator,
  type StepIndicatorProps,
  type Step,
} from './components/step-indicator';
export {
  PhoneInput,
  type PhoneInputProps,
  type CountryCode,
} from './components/phone-input';
export {
  ErrorFallback,
  NotFoundPage,
  PageLoadingSkeleton,
  OfflineBanner,
} from './components/error-boundary';
export {
  useInstallPrompt,
  InstallBanner,
} from './components/install-prompt';
