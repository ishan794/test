declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
  };
  function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}

declare module 'npm:@supabase/supabase-js' {
  export * from '@supabase/supabase-js';
}