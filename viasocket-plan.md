# viaSocket plan — SurpriseMe

Product keys: org `79213`, project `projeQn5v4I8` (secret in `.env` only). viaSocket user id = SurpriseMe `User.id` (never email).
System user for the scheduler: `surpriseme-system`. Test user: `apps-api-test-user`.

| app | action / call (key, version) | inputData key | who supplies it | when |
| --- | --- | --- | --- | --- |
| AI | `user.ai.send` (`anthropic` / `claude-sonnet-5-5`, `json_schema`) | message, prompt, jsonSchema | product (creator's studio answers as data) | per generation / section rewrite |
| gmail | `Send_Email` `v56` (action_id `rowogelpy0h6`) | `to` | creator, on the Share screen | per send |
| gmail | `Send_Email` `v56` | `subject`, `messageBody` | creator text, wrapped in the product's escaped HTML template | per send |
| gmail | `Send_Email` `v56` | `fromName` | product (creator's name on the surprise) | per send |
| gmail | `Send_Email` `v56` | `from`, `cc`, `bcc`, `labelIds`, `attachments` | not used (account default sender) | — |
| google-calendar | `Create_Calendar_Event` `v24` (action_id `rowuitv4m6uy`) | `calendar_id` | constant `primary` (right for every user) | — |
| google-calendar | `Create_Calendar_Event` `v24` | `summary`, `startdate`, `starttime`, `timeZone` | creator, on the reminder form (`timeZone` from the action's 20 supported zones) | per reminder |
| google-calendar | `Create_Calendar_Event` `v24` | `description` | product (note + dashboard link) | per reminder |
| google-calendar | `Create_Calendar_Event` `v24` | `meeting_duration` `00:15`, `attendees` "", `location` "", `useDefault` true, `transparency` transparent | constants | — |
| automation | cron flow "SurpriseMe scheduled delivery tick", `*/5 * * * *` UTC, one step POSTing `APP_URL/api/cron/tick` | — | product (`scripts/setup-scheduler.mts`) | once per deploy |

Who picks the action: always the product's code. Actions run through the user's enabled app (`findEnabled ?? enable`), script_id never stored or sent to the browser.
Who connects: the SurpriseMe creator, through the Connect button (viaSocket popup) on the Share screen or Settings.

VIASOCKET-PENDING(row0904nyxej): Gmail Send_Email's consent scopes miss ListSendAs; Gmail Connect requests the full plug scope set until fixed.

Problems reported to viaSocket: `row0904nyxej` (Send_Email scopes), `rowrwisznxjo` (listConnections returns `id`, docs say `identifier`), `rowxmelejm9k` (Anthropic json_schema rejects minItems).
