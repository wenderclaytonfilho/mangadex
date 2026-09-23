# MangaDesk Web — versão corrigida

Esta versão corrige a tela branca ao abrir localmente.

## Forma mais fácil

No Windows, dê dois cliques em `ABRIR_MANGADESK.bat`.

Se você abrir `index.html` diretamente, a interface também carrega porque o JavaScript foi empacotado em um script clássico, sem imports ES Modules. Para pesquisa e APIs externas, o modo HTTP pelo launcher é o mais compatível.

---

# MangaDesk Web v1.1

Leitor web de mangás feito em **HTML, CSS e JavaScript puro**, pensado principalmente para desktop, mas totalmente responsivo para tablet e celular.

## O que mudou nesta versão

- Interface geral redesenhada e mais consistente.
- Layout responsivo revisado para desktop, tablet e celular.
- Menu lateral com drawer/backdrop em telas menores.
- Leitor paginado corrigido: no modo **Tela inteira** a imagem agora respeita a altura útil do navegador e não fica cortada.
- Uso de `100dvh`, `min-height: 0` e limites explícitos de altura no leitor para evitar overflow de páginas altas.
- Novo ajuste do leitor:
  - Tela inteira
  - Ajustar à largura
  - Tamanho original
- Navegação paginada por áreas laterais.
- Suporte a leitura RTL/LTR.
- Navegação por teclado: setas, A/D, Home, End, F e Esc.
- Gestos de swipe em dispositivos touch.
- Tela cheia no leitor.
- Barra de progresso de páginas.
- Pré-carregamento somente da página atual e páginas vizinhas no modo paginado, reduzindo uso de memória e rede.
- Cor de destaque configurável.
- Biblioteca, favoritos, histórico e progresso continuam persistidos no `localStorage`.
- Backups JSON e snapshots locais mantidos.
- Service Worker atualizado para a nova versão do shell.

## Rodar no Windows

Extraia a pasta e execute:

```text
start_local.bat
```

O MangaDesk abrirá em:

```text
http://localhost:8080
```

Não abra o `index.html` diretamente por `file://`, pois módulos JavaScript e o Service Worker precisam ser servidos por HTTP.

## Rodar manualmente

Com Python instalado:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Publicar na Vercel

1. Envie o conteúdo desta pasta para um repositório ou importe o projeto na Vercel.
2. Framework Preset: **Other**.
3. Build Command: deixe vazio.
4. Output Directory: raiz do projeto.
5. Faça o deploy.

A função `api/mangadex.js` funciona como proxy opcional para a API do MangaDex.

## Dados e backup

O estado principal fica salvo em:

```text
mangadesk.web.state.v2
```

No menu **Backup e dados** você pode:

- exportar toda a biblioteca para JSON;
- importar um backup em outro navegador/PC;
- criar snapshots manuais;
- restaurar snapshots locais;
- manter snapshots automáticos antes de alterações importantes.

> Limpar os dados do navegador também remove o `localStorage`. Para uma cópia realmente portátil, use **Exportar JSON**.

## Leitor

### Vertical

As páginas são exibidas em sequência e o progresso é detectado conforme a rolagem.

### Paginado

O modo recomendado é:

```text
Paginado + Tela inteira
```

Nesse modo cada página é centralizada dentro da área realmente disponível do navegador, sem ultrapassar a toolbar do leitor nem o final da viewport.

Atalhos:

```text
← / →    navegar
A / D    navegar
Home     primeira página
End      última página
F        tela cheia
Esc      sair / primeiro fecha tela cheia
```

Para mangás japoneses, use **Direita → esquerda** nas configurações.

## Fontes personalizadas

Além da integração padrão, o MangaDesk aceita APIs no formato JSON v1.

### `GET /search?q=TERMO&lang=pt-br`

```json
{
  "items": [
    {
      "id": "abc",
      "title": "Título",
      "description": "Descrição",
      "coverUrl": "https://...",
      "status": "ongoing",
      "year": 2026
    }
  ]
}
```

### `GET /manga/{id}/chapters?lang=pt-br`

```json
{
  "items": [
    {
      "id": "cap1",
      "chapter": "1",
      "title": "Capítulo 1",
      "publishedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

### `GET /chapter/{id}/pages`

```json
{
  "pages": [
    "https://.../001.jpg",
    "https://.../002.jpg"
  ]
}
```

A API precisa permitir CORS no navegador ou ser acessada através de um proxy compatível.

## Estrutura

```text
MangaDesk-Web-v2/
├── index.html
├── manifest.webmanifest
├── sw.js
├── vercel.json
├── start_local.bat
├── start_local.sh
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── store.js
│   └── sources.js
├── api/
│   └── mangadex.js
└── assets/
    └── icon.svg
```

O app continua separado das fontes de conteúdo. Fontes adicionais devem respeitar as permissões, termos e direitos aplicáveis de cada serviço.
