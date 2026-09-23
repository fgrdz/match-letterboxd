export type ErrorCode =
  | 'invalid_username'
  | 'not_found'
  | 'blocked'
  | 'private'
  | 'timeout'
  | 'unavailable'
  | 'parser'
  | 'busy'
  | 'scraping_config'
  | 'scraping_payment'
  | 'scraping_rate_limit'
  | 'scraping_unavailable'
  | 'scraping_response'
  | 'scraping_budget'
  | 'scraping_timeout';
const messages: Record<ErrorCode, string> = {
  scraping_config:
    'O serviço de coleta precisa ser configurado. Confira o transporte, a chave e a zona Web Unlocker no servidor.',
  scraping_payment:
    'O serviço de coleta informou um problema de saldo ou cobrança. Confira a conta Bright Data.',
  scraping_rate_limit:
    'O serviço de coleta atingiu seu limite de requisições. Aguarde antes de tentar novamente.',
  scraping_unavailable: 'O serviço de coleta está indisponível agora. Tente novamente mais tarde.',
  scraping_response:
    'O serviço de coleta retornou uma resposta inesperada. A integração precisa ser verificada.',
  scraping_budget:
    'O limite local de consultas ao serviço de coleta foi atingido. Aguarde a renovação da janela de uma hora.',
  scraping_timeout: 'O serviço de coleta demorou para responder. Tente novamente mais tarde.',
  invalid_username:
    'Use apenas o username: letras, números, hífen ou underscore (até 40 caracteres).',
  not_found: 'Esse perfil não foi encontrado. Confira o username.',
  blocked:
    'O Letterboxd restringiu o acesso público agora. A coleta foi interrompida; tente mais tarde.',
  private: 'Esse conteúdo não está disponível publicamente.',
  timeout: 'O Letterboxd demorou para responder. Tente novamente mais tarde.',
  unavailable: 'Não foi possível consultar o Letterboxd agora. Tente novamente mais tarde.',
  parser: 'A estrutura da página não foi reconhecida. O parser precisa ser revisado.',
  busy: 'Já existem comparações em andamento. Aguarde um pouco e tente novamente.',
};
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public retryable = false,
  ) {
    super(messages[code]);
    this.name = 'AppError';
  }
}
export function publicError(error: unknown): string {
  return error instanceof AppError
    ? error.message
    : 'Não foi possível concluir a comparação. Tente novamente mais tarde.';
}
