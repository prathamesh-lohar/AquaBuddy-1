import { Redirect } from 'expo-router';

export default function CaretakerIndex() {
  // Redirect to login by default
  return <Redirect href="/caretaker/login" />;
}