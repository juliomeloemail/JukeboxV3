# Jukebox da Festa — como usar no computador

## 1. Instale o Node.js

Baixe em https://nodejs.org (versão LTS) e instale normalmente. É preciso fazer isso só uma vez.

## 2. Coloque as músicas

Deixe os arquivos em `C:\musicas\jukebox`. Pode usar subpastas — o ideal é
`C:\musicas\jukebox\Artista\Álbum\01 - Musica.mp3`, assim os nomes ficam certinhos
mesmo em arquivos sem informação interna.

## 3. Ligue o programa

Dê dois cliques em **INICIAR-JUKEBOX.bat**. A janela preta mostra:

- quantas músicas foram encontradas;
- o endereço para os convidados, por exemplo `http://192.168.0.10:8099/guest`.

Deixe essa janela aberta durante a festa.

## 4. Abra a tela principal

Abra a Jukebox no navegador do computador da festa. Ela encontra o servidor sozinha
e sai do modo demonstração, mostrando suas músicas de verdade.

## 5. Convidados

No Wi-Fi da casa, os convidados abrem o endereço mostrado na janela preta,
escrevem o nome, procuram a música e tocam em **Pedir**. O pedido entra na fila
da tela principal.

## Dicas

- Se o Windows perguntar sobre a rede, permita o acesso em **redes privadas**.
- Para trocar a pasta, use o botão **Configurações → Músicas** e clique em **Reler pasta**.
- Para mudar a porta, edite o número `8099` no arquivo `INICIAR-JUKEBOX.bat`.
