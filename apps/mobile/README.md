# AtlasMed — Mobile

App Flutter do atlas médico AtlasMed.

## Mock Credentials

| Campo    | Valor                        |
|----------|------------------------------|
| E-mail   | rafael.melo@atlasmed.com     |
| Senha    | Atlas2026                    |
| Código   | 123456                       |

## Screens

- **Login** — Splash, login, forgot password (email → código → nova senha → sucesso)
- **Explore** — Lista de clínicas/médicos com tabs, busca, filtro, ordenação, infinite scroll
- **Facility Detail** — 15 seções (hero, signals, health metrics, products, payers, visit timeline, etc.)
- **Professional Detail** — 8 seções (header, prescribing trends, visit history, field notes, etc.)
- **Profile** — Visão do representante: território (mapa + stats), resumo rápido, preferências, atividade recente, suporte & conta

## Mapa

O mapa nativo usa `mapbox_maps_flutter` e recebe o token público do Mapbox em tempo de execução. Copie `config.template.json` para o arquivo de configuração local adequado e forneça `MAPBOX_ACCESS_TOKEN`, ou execute com:

```sh
fvm flutter run --dart-define=API_BASE_URL=https://api.atlasmed.com --dart-define=MAPBOX_ACCESS_TOKEN=pk.seu_token_publico
```

A tela solicita apenas uma localização atual. A integração de API deve fornecer o território atribuído (GeoJSON `Polygon` ou `MultiPolygon`) e clínicas previamente filtradas pelo escopo autorizado. O cliente não amplia esse escopo.

## Run

```sh
flutter run
```

## Web / Device Preview

No web (`flutter run -d chrome` ou `-d web-server`) o app é exibido
automaticamente dentro do **Device Preview** — sem flag de build. Isso simula o
visual mobile (frame de dispositivo, orientação, escala de texto, idioma)
diretamente no navegador, útil para validar a UI antes de rodar em dispositivo
físico. Em plataformas nativas (Android/iOS) o Device Preview fica desativado.
