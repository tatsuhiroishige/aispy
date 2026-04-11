export interface Config {
  braveApiKey: string;
}

export function loadConfig(): Config {
  const braveApiKey = process.env['BRAVE_API_KEY'];
  if (!braveApiKey) {
    throw new Error('BRAVE_API_KEY is not set');
  }
  return { braveApiKey };
}
