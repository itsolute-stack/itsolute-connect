// Markdown files are imported as raw strings (webpack `asset/source`, configured
// in next.config.ts). The onboarding playbook page renders one of these.
declare module "*.md" {
  const content: string;
  export default content;
}
