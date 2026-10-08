# Vortek — Site comercial e Prospect

Site comercial da Vortek, evoluído a partir do showroom existente, e plataforma de prospecção preservada. A raiz `/` abre `index.html`; a plataforma está em `/prospeccao.html`. Paleta escura, cubo interativo, demonstrações, filtros e favoritos foram mantidos. Backend Node.js modular e SQLite nativo, sem novas dependências.

## Execução local

Requisito: Node.js 24 ou superior.

```powershell
npm.cmd run build
npm.cmd start
```

Abra http://127.0.0.1:3000 para o site e http://127.0.0.1:3000/prospeccao.html para a plataforma. Depois de alterar conteúdo/HTML/CSS/JS, execute `npm run build` para atualizar `dist/`. No PowerShell com scripts desabilitados, use `npm.cmd` em lugar de `npm`.

## Conteúdo e identidade comercial

`assets/site-config.js` centraliza o contato, mensagem inicial, serviços, benefícios, processo, FAQ, demonstrações e futuros projetos. O WhatsApp informado é **(83) 99344-8767**, com link internacional `5583993448767`. `assets/content-render.js` compartilha os renderizadores entre navegador e build; serviços, benefícios, processo e FAQ são pré-renderizados em HTML, disponíveis sem JavaScript e sem chamadas adicionais. `assets/styles.css` mantém a identidade original e centraliza cores e tipografia em variáveis CSS.

O showroom conserva filtros, prévias e favoritos. Novas seleções usam `vortek-favorites`; a antiga chave de armazenamento continua sendo lida exclusivamente para preservar seleções existentes. Não renomeamos arquivos, rotas ou identificadores de integração. A plataforma de prospecção também usa Vortek como única identidade comercial.

O formulário valida nome, empresa, serviço e resumo, prepara uma mensagem e oferece a abertura do WhatsApp ou cópia do texto. Inclui os modelos favoritos. **Não envia automaticamente, não registra o pedido no SQLite e não envia e-mail**: o visitante deve revisar e enviar a mensagem no WhatsApp. Os botões diretos funcionam em hospedagem estática e não dependem do backend. A confirmação final do envio pertence ao WhatsApp, não ao site.

Não foram fornecidos projetos ou depoimentos reais. As prévias estão identificadas como demonstrações, e o portfólio de clientes está em preparação. Não há avaliações, certificações, preços, prazos, clientes ou resultados inventados. Para publicar projetos reais, preencha `projects` com `{name, description, url, image, imageAlt}` usando uma imagem local em `assets/` e uma URL real, com autorização para divulgação. Não preencha `testimonials` sem material real; sua exibição pública ainda exige implementação e revisão.

SEO inclui títulos e descrições por página, HTML semântico, hierarquia de cabeçalhos, Open Graph e imagem social PNG de 1200×630 (aproximadamente 24 KB), favicon SVG, dimensões explícitas e carregamento tardio de futuras imagens de projetos. Não há fontes externas ou bibliotecas visuais. Para URLs canônicas e imagem social absoluta, configure **o domínio real** na variável de ambiente `PUBLIC_SITE_URL` antes de `npm run build`; sem domínio fornecido, não é criada uma URL fictícia. Exemplo com variável de sessão PowerShell: `$env:PUBLIC_SITE_URL='https://SEU-DOMINIO-REAL/'` e `npm.cmd run build`. Use uma URL com barra final e não publique o exemplo.

## Revisão do site

O QA de navegador usa Chrome/Edge instalado, perfil temporário e protocolo local de depuração, sem pacotes adicionais. Inicie `npm start` e rode `npm run test:browser -- http://127.0.0.1:3000`. `BROWSER_PATH` permite selecionar outro executável compatível. Capturas ficam em `.qa/` (ignorado pelo Git). O perfil temporário é removido após o teste quando os arquivos não estiverem bloqueados pelo navegador.

Verificados em Chrome headless: larguras de **1440, 820 e 390 px**, ausência de overflow horizontal, menu móvel, FAQ, prévias, favoritos, filtros, páginas secundárias e formulário com o WhatsApp correto. Um erro antigo de foco após filtrar foi corrigido. O teste não envia mensagens nem verifica se a conta WhatsApp está ativa. Os testes Node preservam a verificação de banco e da plataforma.

Não é necessário criar `.env`, instalar dependências ou obter chaves. Para personalizar, copie `.env.example` para `.env` **somente se ainda não houver um arquivo**. Configurações Google antigas no `.env` são ignoradas; remova a chave antiga quando desejar.

`npm test` valida SQLite, deduplicação, filtros, CSV, Excel XML, consultas OSM com fontes simuladas, cache, limites e endpoints HTTP. Os testes não alimentam a base da aplicação nem acessam serviços externos. `npm run test:live` faz uma única pesquisa pequena de padarias em Santos/SP, usando no máximo cinco resultados e banco em memória; execute somente para diagnóstico pontual, nunca como monitoramento periódico.

## Pesquisa e fontes

- **OpenStreetMap / Overpass:** fonte padrão gratuita, sem chave. Informe cidade ou região, UF e nome/palavra-chave ou segmento. Nominatim encontra a região brasileira e Overpass consulta `node`, `way` e `relation` com tags comerciais. A pesquisa usa a interseção dos limites geográficos retornados com uma janela de até aproximadamente 20 km de largura em torno do centro. Cidades maiores podem ter bairros fora dessa janela: consulte um bairro explicitamente. Não varre áreas sistematicamente nem pagina para extrair todos os estabelecimentos. Até 100 resultados por consulta (configurável entre 1 e 100); ordem não representa relevância. Limite atingido e região reduzida aparecem na interface.
- **Segmentos:** restaurantes, cafés, bares, lanchonetes, dentistas, clínicas, médicos, farmácias, hospitais, bancos, escolas, creches, postos, padarias, supermercados, mercados, roupas, salões, estética, oficinas, petshops, floriculturas, livrarias, eletrônicos, hotéis, pousadas, academias, advogados, contadores e imobiliárias. Também aceita tags explícitas como `shop=bakery`, `amenity=dentist` e `office=lawyer`. Segmentos não reconhecidos retornam orientação para evitar pesquisas amplas acidentais. Nome/palavra-chave procura `name` e `brand`, sem prometer busca semântica ou correspondência sem acentos. Palavras reconhecidas como segmentos podem ser convertidas em tags quando o campo Segmento estiver vazio.
- **Base autorizada:** cadastre empresas manualmente com identificador único, origem e confirmação de autorização para armazenamento. A busca local funciona sem credenciais externas e aceita nome, palavras-chave, segmento, cidade, UF, website e contato. Importação em lote e outras APIs não estão implementadas.
- **Website não informado:** ausência de `contact:website`, `website` ou `url` no OSM. Não comprova ausência de site. O indicador do dashboard conta os leads salvos com esse status. “Ausência confirmada” continua disponível somente para registros manuais cuja fonte tenha sido verificada. URLs cadastradas com formato inseguro não viram links clicáveis.
- **Campos incompletos:** nome, telefone, endereço e website vêm exclusivamente de tags da fonte. Localização consultada não é usada para inventar endereço ausente. Contatos inexistentes na resposta são “Indisponível”. Estabelecimentos sem nome/brand não são incluídos. OpenStreetMap não é um cadastro oficial de empresas: faltas, erros, estabelecimentos fechados e duplicatas cartográficas são possíveis.
- **Armazenamento:** os resultados podem ser salvos sob ODbL. Cada lead mantém o identificador `tipo/id`, origem e licença. O backend salva a cópia recebida da fonte, não campos arbitrários enviados pelo navegador. A chave única `(source, source_id)` elimina duplicação do mesmo objeto OSM; um mesmo negócio mapeado em objetos diferentes ou em outra fonte ainda pode precisar de revisão manual. Atualizar um registro preserva sua etapa comercial.
- **Compatibilidade:** banco e registros anteriores são preservados. A migração acrescenta `source_url`, `license` e tabelas de cache/controle/origem. Referências Google antigas continuam visíveis, editáveis por etapa e removíveis, mas a integração Google foi removida; não há novas consultas, salvamento ou exportação de conteúdo Google.
- **Exportação:** CSV UTF-8 com BOM e separador ponto e vírgula; Excel no formato SpreadsheetML 2003 (`.xml`, abrir no Excel). Não é `.xlsx`. Respeita filtros da base. Inclui registros OSM com licença ODbL e registros manuais marcados como exportáveis; inclui URL de origem, licença e atribuição OSM por linha. Fórmulas são neutralizadas. A declaração de autorização para registros manuais não é verificação automatizada de licença.

## Limites e licença das fontes gratuitas

O uso público do [Nominatim](https://operations.osmfoundation.org/policies/nominatim/) é condicionado à identificação da aplicação, atribuição, cache e **máximo de uma requisição por segundo para toda a aplicação**. Consultas devem ser iniciadas pelo usuário, sem autocomplete, coleta sistemática ou dados pessoais/confidenciais. A adoção neste projeto é para consultas locais pontuais iniciadas explicitamente pelo operador, responsável por cumprir a política. O endpoint pode ser trocado por configuração sem alterar o código.

O serviço aplica intervalo persistente de 1,1 segundo ao Nominatim e 10 segundos ao Overpass, uma busca externa em andamento por instância e coalescência de consultas idênticas. Ao exceder intervalos, recebe erro com tempo de espera, sem enviar requisição externa. Há cache SQLite de geocodificação por 30 dias e de buscas por 15 minutos; cache válido pode ser usado mesmo durante a pausa do provedor. Consultas sem resultados também são reutilizadas. A limpeza de entradas expiradas ocorre ao escrever novos caches; expiração não é apagamento físico imediato. Respostas parciais ou inválidas não são salvas. Há timeout de 15 segundos para geocodificação, 35 segundos no cliente para Overpass e 25 segundos declarados na consulta Overpass. 429/503/504 geram pausa de pelo menos 60 segundos, respeitando `Retry-After` quando maior, sem retries automáticos ou alternância de servidores para contornar limites.

As [instâncias públicas Overpass](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) usam quotas dinâmicas e podem recusar consultas leves por sobrecarga; as diretrizes de aproximadamente 10 mil requisições/dia e 1 GB/dia não são uma garantia ou um direito a consumir esses recursos. Não use as instâncias públicas como infraestrutura de uma plataforma comercial com muitos usuários: configure instâncias próprias ou fontes com capacidade e termos adequados. Os limites deste projeto atendem uma execução local; múltiplas máquinas/processos exigem coordenação global das quotas.

Os dados OSM são disponibilizados sob [ODbL](https://www.openstreetmap.org/copyright), que permite reutilização, inclusive comercial, com atribuição e demais obrigações. Distribuição ou uso público de bases adaptadas pode exigir compartilhamento sob a mesma licença. As exportações incluem atribuição, mas isso por si só não satisfaz todas as obrigações de uma base derivada. Serviços gratuitos têm políticas próprias e nenhuma garantia de disponibilidade, cobertura ou continuidade. A licença de dados não substitui avaliação de base legal LGPD para contatos pessoais.

## Configuração e segurança

O `.env` e `data/` estão ignorados pelo Git. SQLite fica em `data/prospect.sqlite`; `DATABASE_PATH` altera sua localização. O armazenamento está isolado em `server/database.js`; migração PostgreSQL ainda exige um adaptador. O módulo `server/osm.js` concentra geocodificação, tradução de segmentos, integração, cache e normalização, permitindo futuras fontes.

Configuração opcional: `NOMINATIM_URL`, `OVERPASS_URL`, `OSM_RESULT_LIMIT` e `OSM_USER_AGENT`. Defaults constam em `.env.example`; não há API key. Antes de uso compartilhado, configure `OSM_USER_AGENT` com identificação da aplicação e um **contato real do operador**, por exemplo `VORTEK-Prospect/1.1 (https://seu-dominio.example; contato: operador@seu-dominio.example)`, substituindo os exemplos. Configure apenas endpoints sob sua confiança: URLs são controladas pelo administrador, não pelo usuário da pesquisa.

Por padrão o serviço escuta somente em loopback. `APP_TOKEN`, quando configurado, protege todas as rotas `/api/`; informe o token em Configurações da interface. O token fica na memória da aba. Para outro HOST o serviço exige token com pelo menos 24 caracteres. Existe uma única base compartilhada: não há usuários, papéis, login por conta ou isolamento entre clientes. Todos os portadores do token têm permissão de leitura, criação, edição, exclusão e exportação. Antes de operação pública, implemente autenticação individual, autorização, HTTPS, governança de retenção, backups e quotas distribuídas. O limite em memória atende uma instância local e reinicia com o processo.

Há validação de corpo/tamanho, SQL parametrizado, bloqueio de origem cruzada, escape de HTML, URLs HTTP/HTTPS, CSP, prevenção de fórmulas em exportação e respostas genéricas para falhas internas. O aplicativo não contorna bloqueios e não faz scraping.

## Dados e privacidade

Não há base inicial ou indicadores fictícios. Apagar um lead o remove da tabela de leads, mas não remove snapshots de origem (`source_records`), histórico, cache ou a fonte pública. O operador deve definir retenção e exclusão desses outros registros e de seus backups. Histórico pode conter dados pessoais digitados: não envie informações confidenciais aos provedores. O operador responde pela finalidade, base legal LGPD, minimização e atendimento aos titulares. Políticas e atribuição OSM estão acessíveis na interface; adapte os termos à sua organização antes de disponibilizar publicamente.

## Hospedagem existente

O manifesto `.openai/hosting.json` do showroom foi preservado. Hospedagem estática de `dist/` **não executa** o backend Node/SQLite: a plataforma informa essa limitação. Publique este servidor em ambiente Node.js com volume persistente quando quiser disponibilizar funcionalidades online. Nenhuma publicação remota foi realizada nesta implementação local.

## Verificação

Testes cobrem consultas com provedores simulados, comunicação HTTP frontend/backend, armazenamento verificado, deduplicação, filtros, histórico, etapas, CSV/Excel XML, atribuição, cache persistente, coalescência, intervalo de requisições e erros externos. Em 08/10/2026, uma consulta real a Nominatim + Overpass localizou Santos/SP e retornou cinco padarias com limite explícito, sem alimentar a base operacional. A rede restrita da sessão exigiu execução autorizada para essa verificação. A disponibilidade futura depende dos provedores.

O dashboard e seus breakpoints foram preservados. A revisão desta evolução incluiu o site comercial e showroom em navegador local; a integração OSM permanece coberta pelos testes da plataforma. Nenhuma publicação remota foi executada.
