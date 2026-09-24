import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';
const config: NextConfig = { turbopack: { root: process.cwd() } };
export default withWorkflow(config);
