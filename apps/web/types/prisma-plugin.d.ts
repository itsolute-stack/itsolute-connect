// The Prisma Next.js monorepo workaround plugin ships no type declarations.
declare module "@prisma/nextjs-monorepo-workaround-plugin" {
  import type { WebpackPluginInstance } from "webpack";
  export class PrismaPlugin implements WebpackPluginInstance {
    constructor();
    apply(compiler: unknown): void;
  }
}
