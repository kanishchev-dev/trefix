import { Image, type ImageSourcePropType } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AuthCopy } from "../../locales";
import { AuthScreen } from "./auth-screen";
import { AuthVerificationScreen } from "./auth-verification-screen";
import { type useSignIn } from "./use-sign-in";

type AuthStackParamList = {
  email: undefined;
  verification: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: AuthCopy;
  logoSource: ImageSourcePropType;
  signIn: ReturnType<typeof useSignIn>;
};

/** Email → code screens, with Google and Apple on the first one. */
export function AuthNavigator({
  theme,
  themeMode,
  copy,
  logoSource,
  signIn,
}: Props) {
  const isAuthBusy = signIn.isEmailSubmitting || signIn.isSocialSubmitting;

  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.color.background },
        headerTitleAlign: "center",
        headerTintColor: theme.color.foreground,
      }}
    >
      <AuthStack.Screen
        name="email"
        options={{ headerShown: false, headerBackTitle: "" }}
      >
        {({ navigation }) => (
          <AuthScreen
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            email={signIn.email}
            isEmailSubmitting={isAuthBusy}
            isSocialSubmitting={signIn.isSocialSubmitting}
            isSocialDisabled={isAuthBusy}
            showGoogleButton={signIn.isGoogleAuthAvailable}
            showAppleButton={signIn.isAppleAuthAvailable}
            onEmailChange={signIn.setEmail}
            onSubmitEmail={(submittedEmail) => {
              signIn.setEmail(submittedEmail);
              void signIn.submitEmail(submittedEmail, () =>
                navigation.navigate("verification"),
              );
            }}
            onGooglePress={() => {
              void signIn.signInWithGoogle();
            }}
            onApplePress={() => {
              void signIn.signInWithApple();
            }}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen
        name="verification"
        options={{
          headerTransparent: true,
          headerBackButtonDisplayMode: "minimal",
          headerTitle: () => (
            <Image
              source={logoSource}
              style={{ width: 160, height: 40 }}
              resizeMode="contain"
            />
          ),
          headerTintColor: theme.color.foreground,
          headerBackTitle: "",
        }}
      >
        {() =>
          signIn.challenge ? (
            <AuthVerificationScreen
              theme={theme}
              copy={copy}
              email={signIn.email}
              challenge={signIn.challenge}
              isSubmitting={signIn.isVerificationSubmitting}
              onSubmitCode={signIn.submitCode}
              onResendCode={() => signIn.resendCode()}
            />
          ) : null
        }
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}
