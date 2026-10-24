# Agent Relay — обзор перед подключением

Дата проверки: 24.10.2026. **Статус: только исследование; Relay не установлен, конфигурации Codex и hooks не менялись.** Опциональная установка — MH-015. Передача через GitHub уже работает самостоятельно.

## Закреплённая версия и границы проверки

- Официальный проект: [AgentWorkforce/relay](https://github.com/AgentWorkforce/relay).
- Проверен опубликованный [релиз v14.0.0](https://github.com/AgentWorkforce/relay/releases/tag/v14.0.0), 13.10.2026. Tag object `db443345d095743072454131ff041bd99b4a34dc` разрешён в commit `77c6d1e87296f186c631bc7f3945668ac7b0c697`.
- npm metadata для `agent-relay@14.0.0` ([registry](https://registry.npmjs.org/agent-relay/14.0.0)): тот же официальный repository, Node >=22.0.0, CLI `agent-relay`/`relay`. Integrity tarball: `sha512-L5O9xYCEQbMx5mIA7DzTOLJ7zj9ZJoSIp0UwjuqBscfXWen2wfK5PZ3MVvL5Dz84TbL0N7INMd8jAEPDxF2f/A==`.
- SHA-512 скачанного tarball совпал с metadata; package.version = 14.0.0. Пакет не исполнялся и не устанавливался.
- Изучены исходники по этому SHA, а не только изменяемый README в main. Это проверка происхождения, версии и поведения исходников; совместимость с текущим desktop-клиентом и доставка сообщений пока не доказаны.

## Что делает штатная Codex-интеграция

Официальный [setup.sh](https://github.com/AgentWorkforce/relay/blob/77c6d1e87296f186c631bc7f3945668ac7b0c697/plugins/codex-relay-skill/scripts/setup.sh) при наличии jq изменяет указанный TARGET_ROOT (по умолчанию текущую папку):

| Файл/настройка | Изменение |
| --- | --- |
| `.codex/config.toml` | `features.codex_hooks = true`; добавление `approval_policy = "on-request"`, если его нет; MCP `npx -y agent-relay mcp` без фиксации версии |
| `.codex/hooks.json` | Добавляет/заменяет собственные группы SessionStart, UserPromptSubmit, Stop |
| `.codex/agents/relay-worker.toml` | Копирует определение worker-агента |
| Скрипты установленного skill | Делает setup и hook-скрипты исполняемыми |

По [SessionStart](https://github.com/AgentWorkforce/relay/blob/77c6d1e87296f186c631bc7f3945668ac7b0c697/plugins/codex-relay-skill/hooks/session-start.sh): повторяет setup, читает `.env` skill, может создавать удалённый workspace и регистрировать агента, сохраняет ключ, токен и JSON с credentials в `~/.relay/agents/<имя>/` (также читает старый `~/.relay/workspace-key`). Права записанных секретных файлов — 0600. Это изменения вне репозитория.

[UserPromptSubmit](https://github.com/AgentWorkforce/relay/blob/77c6d1e87296f186c631bc7f3945668ac7b0c697/plugins/codex-relay-skill/hooks/prompt-inbox.sh) опрашивает inbox и добавляет сообщения в контекст; [Stop](https://github.com/AgentWorkforce/relay/blob/77c6d1e87296f186c631bc7f3945668ac7b0c697/plugins/codex-relay-skill/hooks/stop-inbox.sh) может блокировать выход при непрочитанных сообщениях. Для одного последовательного исполнителя эти механизмы избыточны. Штатный skill не активировали и его setup не запускали.

## Предложение для Mission Hero [П]

Использовать только MCP stdio с фиксированной версией и ручными статусами. [Официальная документация Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) допускает проектный `.codex/config.toml`, передачу переменных через `env_vars` и ограничение `enabled_tools`. Проект должен быть доверенным. В репозитории подготовлен **неактивный** [пример](relay.config.example.toml); он не загружается Codex из папки docs.

После согласования затрагиваются:

| Область | Необходимый доступ/изменение |
| --- | --- |
| Проект | Добавить только MCP-блок в `.codex/config.toml`, после проверки существующих настроек и резервной копии. В примере `enabled=false`; включать при готовом ключе |
| Процесс | Запустить `npx -y agent-relay@14.0.0 mcp` на Node 22; npm скачает пакет/зависимости в пользовательский cache `~/.npm`. Глобальная npm-установка не нужна |
| Сеть | npm registry для пакета; HTTPS/WSS к `cast.agentrelay.com` для статусов и чтения канала. MCP также пытается обнаружить опциональные Cloud shared-session tools; allowlist их не предоставляет агенту |
| Workspace | Имеющийся workspace владельца, регистрация одного имени, создание/чтение/присоединение к каналу `mission-hero-status`, отправка сообщений и проверка inbox |
| Credentials | `RELAY_WORKSPACE_KEY` передаётся окружением запуска Codex из приватного источника вне Git; не вставлять в чат, командную строку, TOML или handoff. Не печатать ответы register_agent целиком — они содержат токен |
| Локальные данные | MCP-команды create/set workspace могут сохранять `.agentworkforce/relay/workspace-key.json`; create с именем также выбирает workspace в глобальном store. Эти команды исключены из примера. Runtime-каталоги исключены из Git независимо от способа запуска |
| Телеметрия | В процессе MCP выставить `AGENT_RELAY_TELEMETRY_DISABLED=1`, согласно [TELEMETRY.md](https://github.com/AgentWorkforce/relay/blob/77c6d1e87296f186c631bc7f3945668ac7b0c697/TELEMETRY.md); не менять глобальную настройку |

Allowlist — ограничение доступных агенту инструментов, не OS sandbox для стороннего процесса. Процесс CLI выполняется с правами пользователя и получает workspace key. Ключ даёт доступ к workspace, поэтому нужен выделенный workspace без чужих секретов. Не включать capture/shared sessions, загрузку файлов, действия, запуск агентов или Cloud-интеграции.

Перед включением убедиться, что непустой ключ нужного workspace доступен **процессу Codex**, а не только соседнему shell. В отсутствие ключа MCP может выбрать ранее сохранённый workspace — запуск с непроверенным окружением недопустим. `RELAY_SKIP_BOOTSTRAP=1` в примере отключает автоматическую регистрацию; затем вручную `register_agent` и проверка фактического имени. Поведение сверено с [MCP source](https://github.com/AgentWorkforce/relay/blob/77c6d1e87296f186c631bc7f3945668ac7b0c697/packages/cli/src/cli/agent-relay-mcp.ts).

**Глобальные config, shell profile, approval policy, hooks и worker definitions в предложении не меняются.** Если выбран штатный skill вместо этого плана, сначала отдельно согласовать его перечисленные эффекты. Не применять curl|bash и не заменять pin на latest.

## Проверка после согласования (MH-015)

1. Подготовить выбранный workspace и приватную передачу ключа; без существующего workspace сначала согласовать создание и его локальные/глобальные записи. Не создавать его автоматически.
2. Проверить версию CLI 14.0.0 и Node >=22; добавить/включить блок, перезапустить MCP в Codex. Проверить доступный allowlist. Не расширять sandbox или политику разрешений.
3. Зарегистрировать одного `mission-hero-codex`, проверить возвращённое имя. Найти/создать `mission-hero-status`, присоединиться. Протокол инструментов — [messaging-tools.ts](https://github.com/AgentWorkforce/relay/blob/77c6d1e87296f186c631bc7f3945668ac7b0c697/packages/cli/src/cli/mcp/messaging-tools.ts).
4. Последовательно отправить тестовые `STATUS`, `PROGRESS`, `BLOCKED`, `DONE` с `test=true` (не менять ради теста статус разработки), затем `list_messages` проверить все четыре текста и ID. Второго агента не запускать. Отдельно проверить продолжение через GitHub при выключенном MCP.
5. Записать дату, версии, безопасные ID/результаты в HANDOFF; не сохранять ключ/токен. Только после чтения сообщений отметить транспорт проверенным. DONE тестового сообщения не завершает MH-002.

Откат: отключить только этот MCP-блок (`enabled=false`) и остановить его процесс; при необходимости восстановить резервную копию config, не удаляя чужие настройки. Убрать ключ из окружения, отозвать выданные credentials средствами владельца workspace. Runtime-файлы удалять только после проверки их принадлежности. `.gitignore` не защищает уже отслеживаемые секреты — при утечке сначала отзыв ключа.

Для внешнего ChatGPT или другого агента требуется собственный совместимый Relay-клиент и безопасно выданный доступ к тому же workspace. Само подключение Codex не создаёт мост в веб-чат. Надёжный handoff для всех сред остаётся в GitHub.
