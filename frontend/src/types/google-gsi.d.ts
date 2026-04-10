/** Minimal types for Google Identity Services (accounts.google.com/gsi/client). */
export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              width?: number;
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            },
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}
