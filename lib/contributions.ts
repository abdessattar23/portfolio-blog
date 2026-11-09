export type {WorkCase as Contribution} from './content/schema';
export {getWorkCase as getContribution, workCases as contributions} from './content/load';

export const prUrl = (number: number) =>
  `https://github.com/open-telemetry/opentelemetry-java/pull/${number}`;
