# Proveniência dos fixtures

- A página pública `https://letterboxd.com/jack/films/` foi reinspecionada em 23/09/2026 via transporte Bright Data configurado (HTTP 200) para confirmar `.poster-viewingdata .like.icon-liked` e ausência de coração em outros cards. Os testes de likes usam esses mesmos formatos já presentes em `films.html`.

Extraídos em 23/09/2026 do HTML retornado por requisições públicas sem autenticação, usando User-Agent `LetterboxdMatch/0.1 (personal non-commercial project)`.

- `films.html`: cabeçalho de perfil, três cards reais e paginação de https://letterboxd.com/jack/films/ (HTTP 200). Cheerio serializou os fragmentos; entidades e aspas podem ter sido normalizadas sem alterar a estrutura.
- `empty-watchlist.html`: cabeçalho de perfil e mensagem `No films yet` de https://letterboxd.com/usernamesignin/watchlist/.

Não incluem cookies, tokens, scripts nem páginas completas. Variantes de falha nos testes são alterações deliberadas desses fixtures, não observações de HTML adicional. O perfil principal e a watchlist de `jack` retornaram proteção e não foram usados como fixtures de sucesso. Uma watchlist preenchida ainda não foi inspecionada com sucesso; não se declara cobertura dessa variante real.
