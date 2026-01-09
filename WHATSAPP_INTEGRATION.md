# Integração WhatsApp - Opina Já!

## Visão Geral

A integração com WhatsApp permite que o sistema envie automaticamente notificações quando uma nova reclamação for recebida. As mensagens podem ser enviadas para um contato individual ou grupo do WhatsApp.

## Arquitetura da Integração

### 1. Componentes Criados

#### Backend
- **`services/whatsapp-service.js`**: Service layer para comunicação com a API WhatsApp
  - Criação de instâncias
  - Conexão via QR Code
  - Envio de mensagens
  - Listagem de grupos
  - Gerenciamento de status

- **`routes/whatsapp.js`**: Endpoints REST para gerenciar WhatsApp
  - `POST /api/whatsapp/instance/create` - Criar instância
  - `POST /api/whatsapp/instance/connect` - Gerar QR Code
  - `GET /api/whatsapp/instance/status` - Verificar status
  - `DELETE /api/whatsapp/instance` - Deletar instância
  - `GET /api/whatsapp/groups` - Listar grupos
  - `POST /api/whatsapp/send` - Enviar mensagem (teste)
  - `PUT /api/whatsapp/config` - Salvar configurações

- **Webhook Endpoint**: `POST /api/whatsapp-webhook/:userId`
  - Recebe eventos da API WhatsApp
  - Atualiza status de conexão automaticamente

#### Frontend
- **`views/register.html`**: Atualizado para incluir campo de telefone
- **`views/spa/integrations.html`**: Interface completa de gerenciamento
  - Botão de conexão
  - Modal com QR Code
  - Formulário de configuração de mensagens
  - Seleção de destinatário (contato ou grupo)
  - Status em tempo real

#### Database
- **Tabela `users`**: Adicionado campo `phone`
- **Tabela `integrations`**: Adicionados campos:
  - `whatsapp_instance_name`
  - `whatsapp_token`
  - `whatsapp_status`
  - `whatsapp_qrcode`
  - `whatsapp_send_to_type`
  - `whatsapp_send_to_jid`

### 2. Fluxo de Funcionamento

#### A. Registro de Usuário
1. Usuário se cadastra informando telefone (formato: 5511999999999)
2. Telefone é salvo no banco de dados

#### B. Conexão do WhatsApp
1. Usuário acessa a tela de Integrações
2. Clica em "Conectar WhatsApp"
3. Sistema cria instância na API WhatsApp
4. Sistema gera QR Code
5. Usuário escaneia QR Code com WhatsApp
6. Sistema monitora status de conexão (polling a cada 3s)
7. Ao conectar, modal fecha e status é atualizado

#### C. Configuração
1. Usuário define mensagem padrão com variáveis:
   - `{cliente}` - Nome do cliente
   - `{nome}` - Nome do reclamante
   - `{email}` - Email do reclamante
   - `{telefone}` - Telefone do reclamante
   - `{topico}` - Tópico da reclamação
   - `{reclamacao}` - Texto da reclamação

2. Escolhe destinatário:
   - **Contato individual**: Informa número no formato 5511999999999
   - **Grupo**: Seleciona grupo da lista carregada

3. Salva configuração

#### D. Disparo Automático
1. Cliente preenche formulário de reclamação
2. Sistema salva reclamação no banco
3. Sistema verifica se WhatsApp está configurado e conectado
4. Substitui variáveis na mensagem template
5. Envia mensagem para o destinatário configurado
6. Log é registrado (sucesso ou erro)

## API WhatsApp - Endpoints Utilizados

### Base URL
```
https://audeagencia.uazapi.com
```

### AdminToken (apenas para criar instância)
```
BatMrOd3sftAJGhwUApsvDt4V6XygQtTwAo5XvohTa8TW7ifal
```

### 1. Criar Instância
```bash
POST /instance/init
Headers:
  admintoken: BatMrOd3sftAJGhwUApsvDt4V6XygQtTwAo5XvohTa8TW7ifal
Body:
  {
    "name": "opinaja-{userId}-{timestamp}",
    "systemName": "OpinaJá!",
    "fingerprintProfile": "chrome",
    "browser": "chrome"
  }
Response:
  {
    "token": "xxxx-xxxx-xxxx",
    "instance": { "name": "..." }
  }
```

### 2. Conectar Instância (QR Code)
```bash
POST /instance/connect
Headers:
  token: {instance_token}
Body:
  {
    "phone": "5511999999999"
  }
Response:
  {
    "qrcode": "data:image/png;base64,...",
    "state": "connecting"
  }
```

### 3. Verificar Status
```bash
GET /instance/status
Headers:
  token: {instance_token}
Response:
  {
    "state": "open" | "connecting" | "disconnected"
  }
```

### 4. Deletar Instância
```bash
DELETE /instance
Headers:
  token: {instance_token}
```

### 5. Configurar Webhook
```bash
POST /webhook
Headers:
  token: {instance_token}
Body:
  {
    "enabled": true,
    "url": "https://seu-dominio.com/api/whatsapp-webhook/{userId}",
    "events": ["messages", "connection"],
    "excludeMessages": ["wasSentByApi"]
  }
```

### 6. Enviar Mensagem
```bash
POST /send/text
Headers:
  token: {instance_token}
Body:
  {
    "number": "5511999999999",
    "text": "Mensagem aqui"
  }
```

### 7. Listar Grupos
```bash
GET /group/list
Headers:
  token: {instance_token}
Response:
  {
    "groups": [
      {
        "id": "120363xxxxx@g.us",
        "subject": "Nome do Grupo",
        "name": "Nome do Grupo"
      }
    ]
  }
```

## Configuração para Produção

### Atualizar URL e AdminToken

Quando migrar para produção, atualizar as credenciais em:

**Arquivo**: `services/whatsapp-service.js`

```javascript
// Linha 1-2
const WHATSAPP_API_URL = 'https://nova-url-producao.com';
const ADMIN_TOKEN = 'seu-novo-admin-token';
```

### Configurar Webhook URL

O webhook deve apontar para o domínio em produção:

```javascript
// Exemplo de URL webhook em produção
https://seu-dominio.com/api/whatsapp-webhook/{userId}
```

## Variáveis de Mensagem

As seguintes variáveis podem ser usadas na mensagem template:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{cliente}` | Nome do cliente/estabelecimento | "Restaurante XYZ" |
| `{nome}` | Nome do reclamante | "João Silva" |
| `{email}` | Email do reclamante | "joao@email.com" |
| `{telefone}` | Telefone do reclamante | "(11) 98765-4321" |
| `{topico}` | Tópico da reclamação | "Atendimento" |
| `{reclamacao}` | Texto completo da reclamação | "Fui mal atendido..." |

### Exemplo de Mensagem Template

```
🔔 *Nova reclamação recebida!*

📍 Cliente: {cliente}
👤 Nome: {nome}
📧 Email: {email}
📱 Telefone: {telefone}
📋 Tópico: {topico}

💬 *Reclamação:*
{reclamacao}
```

## Formato de Telefone

**Importante**: Todos os números devem estar no formato internacional sem espaços ou símbolos:

```
Formato: [código país][DDD][número]
Exemplo: 5511999999999

✅ Correto: 5511999999999
❌ Errado: +55 11 99999-9999
❌ Errado: (11) 99999-9999
❌ Errado: 11999999999
```

## Segurança

### Armazenamento de Tokens
- Tokens são armazenados criptografados no banco de dados SQLite
- Apenas o usuário autenticado pode acessar seu próprio token

### Validação
- Todas as rotas requerem autenticação via JWT
- Validação de formato de telefone no frontend e backend
- Sanitização de dados antes de enviar para API

### Logs
- Todos os eventos são registrados com timestamp
- Erros de envio não interrompem o fluxo principal
- Logs incluem: criação de instância, conexões, envios, erros

## Monitoramento

### Status de Conexão
- **Conectado** (verde): WhatsApp está ativo e pronto
- **Desconectado** (vermelho): WhatsApp não está conectado
- **Conectando** (amarelo): Aguardando escaneamento do QR Code

### Verificação de Status
O sistema verifica automaticamente o status a cada 3 segundos durante o processo de conexão via QR Code.

## Limitações e Considerações

1. **Uma instância por usuário**: Cada usuário pode ter apenas uma instância WhatsApp conectada
2. **Número único**: O mesmo número de telefone não pode ser usado em múltiplas instâncias
3. **Timeout de QR Code**: QR Code expira após alguns minutos (necessário regenerar)
4. **Rate Limiting**: A API WhatsApp pode ter limites de envio
5. **Mensagens de grupos**: Para enviar em grupos, o número conectado deve ser membro do grupo

## Troubleshooting

### QR Code não aparece
- Verificar se o telefone foi cadastrado corretamente
- Verificar logs do servidor para erros na API
- Tentar criar nova instância

### Mensagens não são enviadas
- Verificar se WhatsApp está conectado (status verde)
- Verificar se destinatário foi configurado
- Verificar formato do número de telefone
- Checar logs para detalhes do erro

### Desconexão frequente
- WhatsApp Web pode desconectar se o celular ficar offline
- Verificar estabilidade da internet do celular
- Reescanear QR Code se necessário

### Grupos não aparecem
- Certificar que o número conectado é membro dos grupos
- Clicar em "Recarregar grupos"
- Verificar se a conexão está ativa

## Estrutura de Código

```
review-filter/
├── services/
│   └── whatsapp-service.js       # Service layer da API WhatsApp
├── routes/
│   ├── whatsapp.js               # Endpoints de gerenciamento
│   └── review.js                 # Atualizado com disparo automático
├── views/
│   ├── register.html             # Cadastro com telefone
│   └── spa/
│       └── integrations.html     # Interface de configuração
├── database.js                   # Schema atualizado
└── server.js                     # Rotas registradas
```

## Próximas Melhorias Sugeridas

1. **Múltiplos destinatários**: Permitir enviar para múltiplos contatos/grupos
2. **Agendamento**: Agendar envio de relatórios periódicos
3. **Templates personalizados**: Criar múltiplos templates de mensagem
4. **Estatísticas**: Dashboard com métricas de envios
5. **Retry automático**: Retentar envio em caso de falha
6. **Notificações de resposta**: Capturar respostas do WhatsApp
7. **Rich messages**: Suporte para imagens, documentos, botões

## Suporte

Para dúvidas ou problemas:
1. Verificar logs do servidor
2. Consultar documentação da API WhatsApp
3. Verificar configurações no painel de integrações
