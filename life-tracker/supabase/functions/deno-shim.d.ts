// Type-checking aid only (`npx tsc -p supabase/functions`): the Deno globals the
// Edge Functions use. Supabase's runtime provides the real ones.
declare namespace Deno {
  const env: { get(name: string): string | undefined };
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}
