export const SKILL_SYNONYMS: Record<string, string> = {
  // JavaScript
  js: 'javascript',
  es6: 'javascript',
  'vanilla js': 'javascript',
  vanillajs: 'javascript',

  // TypeScript
  ts: 'typescript',

  // React
  reactjs: 'react',
  'react.js': 'react',
  'react js': 'react',

  // Angular
  angularjs: 'angular',
  'angular.js': 'angular',

  // Vue
  vuejs: 'vue',
  'vue.js': 'vue',
  'vue js': 'vue',

  // Node.js
  node: 'nodejs',
  'node.js': 'nodejs',
  'node js': 'nodejs',

  // Next.js
  'next.js': 'nextjs',
  next: 'nextjs',

  // Express
  expressjs: 'express',
  'express.js': 'express',

  // NestJS
  nestjs: 'nestjs',
  'nest.js': 'nestjs',

  // Databases
  postgres: 'postgresql',
  pg: 'postgresql',
  mongo: 'mongodb',
  'my sql': 'mysql',
  'ms sql': 'mssql',
  'sql server': 'mssql',
  'microsoft sql server': 'mssql',

  // Cloud
  k8s: 'kubernetes',
  kube: 'kubernetes',
  gcp: 'google cloud',
  'google cloud platform': 'google cloud',
  aws: 'amazon web services',
  'amazon aws': 'amazon web services',
  azure: 'microsoft azure',
  'ms azure': 'microsoft azure',

  // CI/CD
  'github actions': 'github-actions',
  'gitlab ci': 'gitlab-ci',
  'circle ci': 'circleci',
  'jenkins ci': 'jenkins',

  // Python
  py: 'python',
  python3: 'python',
  'python 3': 'python',

  // Java versions
  'java 8': 'java',
  'java 11': 'java',
  'java 17': 'java',
  'java 21': 'java',

  // .NET / C#
  'c sharp': 'csharp',
  'c#': 'csharp',
  '.net': 'dotnet',
  'asp.net': 'dotnet',
  'asp net': 'dotnet',
  '.net core': 'dotnet',

  // CSS
  css3: 'css',
  html5: 'html',
  sass: 'scss',

  // DevOps tools
  'git hub': 'github',
  'bit bucket': 'bitbucket',
  'vs code': 'vscode',
  'visual studio code': 'vscode',

  // API
  rest: 'rest api',
  restful: 'rest api',
  'restful api': 'rest api',
  'graphql api': 'graphql',

  // Messaging
  'redis cache': 'redis',
  rabbitmq: 'message queue',
  'elastic search': 'elasticsearch',

  // Containers
  'docker container': 'docker',
  tf: 'terraform',

  // AI/ML
  ml: 'machine learning',
  dl: 'deep learning',
  nlp: 'natural language processing',
  cv: 'computer vision',

  // Misc
  'spring boot': 'springboot',
  'spring framework': 'spring',
  laravel: 'laravel',
  rails: 'ruby on rails',
  'ruby on rails': 'ruby on rails',
  ror: 'ruby on rails',

  // Testing
  'unit testing': 'testing',
  'e2e testing': 'testing',
  'integration testing': 'testing',

  // Agile
  'agile methodology': 'agile',
  'scrum methodology': 'scrum',
};

export function normalizeSkill(skill: string): string {
  const lower = skill.toLowerCase().trim();
  return SKILL_SYNONYMS[lower] ?? lower;
}

export const TECH_KEYWORDS = new Set([
  // Languages
  'javascript', 'typescript', 'python', 'java', 'csharp', 'dotnet', 'go', 'golang',
  'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'c', 'cpp', 'elixir',

  // Frontend
  'react', 'angular', 'vue', 'svelte', 'nextjs', 'nuxtjs', 'remix', 'astro',
  'html', 'css', 'scss', 'sass', 'tailwind', 'bootstrap', 'material ui', 'chakra ui',

  // Backend
  'nodejs', 'express', 'fastify', 'nestjs', 'django', 'flask', 'fastapi',
  'spring', 'springboot', 'laravel', 'ruby on rails', 'gin', 'fiber', 'echo',
  'actix', 'axum', 'hapi', 'koa',

  // Databases
  'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'cassandra',
  'sqlite', 'mssql', 'oracle', 'dynamodb', 'firestore', 'supabase', 'cockroachdb',
  'neo4j', 'influxdb', 'clickhouse', 'mariadb',

  // ORMs
  'prisma', 'typeorm', 'sequelize', 'mongoose', 'hibernate', 'sqlalchemy', 'gorm',

  // DevOps
  'docker', 'kubernetes', 'terraform', 'ansible', 'helm', 'vagrant',
  'amazon web services', 'google cloud', 'microsoft azure', 'cloudflare',
  'github-actions', 'gitlab-ci', 'jenkins', 'circleci', 'travis ci', 'argocd', 'flux',
  'nginx', 'apache', 'caddy',

  // Messaging
  'message queue', 'apache kafka', 'rabbitmq', 'nats', 'sqs', 'pubsub',

  // API
  'rest api', 'graphql', 'grpc', 'websocket', 'trpc', 'openapi', 'swagger',

  // Version control
  'git', 'github', 'gitlab', 'bitbucket',

  // Testing
  'jest', 'vitest', 'pytest', 'junit', 'cypress', 'playwright', 'selenium',
  'testing', 'mocha', 'chai', 'storybook',

  // Build tools
  'webpack', 'vite', 'rollup', 'babel', 'esbuild', 'turbopack',

  // Monitoring
  'prometheus', 'grafana', 'datadog', 'new relic', 'sentry', 'opentelemetry',

  // Mobile
  'ios', 'android', 'react native', 'flutter', 'expo', 'swift', 'kotlin',

  // AI/ML
  'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras',
  'natural language processing', 'computer vision', 'scikit-learn', 'pandas', 'numpy',

  // Architecture
  'microservices', 'serverless', 'monorepo', 'event-driven', 'domain-driven design',
  'system design', 'distributed systems', 'cqrs', 'event sourcing',

  // Methodologies
  'agile', 'scrum', 'kanban', 'devops', 'sre', 'tdd', 'bdd', 'ci', 'cd',

  // Security
  'cybersecurity', 'owasp', 'jwt', 'oauth', 'openid connect', 'saml',

  // Other
  'linux', 'bash', 'shell scripting', 'powershell',
  'blockchain', 'solidity', 'web3', 'ethereum',
  'elasticsearch', 'redis', 'memcached',
  'graphql', 'apollo', 'hasura',
  'jira', 'confluence', 'notion',
]);
