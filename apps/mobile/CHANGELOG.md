# Changelog

Todas as alterações notáveis neste projeto serão documentadas aqui.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

Gerenciado por [Cider](https://cider.sh/).

Os títulos de versão seguem `## <versão> - <data>`, sem colchetes: o Cider
identifica releases por esse formato. Com `## [1.2.0+8] — …` ele não reconhece
nenhuma versão, escapa os títulos existentes e grava a nova seção no fim do
arquivo. A seção pendente precisa se chamar exatamente `## Unreleased`, que é o
que `cider release` promove para a versão recém-gerada.

---

## Unreleased

### Corrigido

- `NSLocationAlwaysAndWhenInUseUsageDescription` no `Info.plist`, exigida pela App Store (erro 90683) porque o geolocator referencia as APIs de autorização "always".

### Alterado

- `MinimumOSVersion` do iOS de 14.0 para 15.0, antecipando a exigência da App Store a partir da primavera de 2027 (aviso 90068).
- iOS passa a ser exclusivo para iPhone (`TARGETED_DEVICE_FAMILY = 1`); as orientações específicas de iPad saíram do `Info.plist`.
- Android deixa de ser instalável em tablets via `supports-screens` no `AndroidManifest.xml`.

## 1.2.0+8 - 2026-08-14

### Alterado

- Android e iOS voltam a compartilhar a mesma release Shorebird (`1.2.0+8`).

## 1.0.0+1 - 2026-07-21

### Adicionado

- Versão inicial do aplicativo AtlasMed Mobile.
