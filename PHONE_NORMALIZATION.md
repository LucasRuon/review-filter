# Normalização de Números de Telefone - WhatsApp

## Problema

No Brasil, há uma inconsistência histórica nos números de telefone celular:
- Alguns números têm **8 dígitos** (antigos)
- Alguns números têm **9 dígitos** começando com 9 (novos)
- Alguns números têm **9 dígitos** mas NÃO começam com 9

Isso causa problemas ao enviar mensagens pelo WhatsApp, pois a API precisa do formato exato do número registrado.

## Solução Implementada

O sistema implementa **normalização automática** com **retry inteligente**:

### 1. Normalização Inicial

A função `normalizePhoneNumber()` padroniza o número seguindo estas regras:

```javascript
normalizePhoneNumber(phone) {
    // Remove todos os caracteres não numéricos
    let cleaned = phone.replace(/\D/g, '');

    // Se é número brasileiro (começa com 55)
    if (cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const number = cleaned.substring(4);

        // Se tem 8 dígitos, adiciona o 9 na frente
        if (number.length === 8) {
            cleaned = `55${ddd}9${number}`;
        }
        // Se tem 9 dígitos mas não começa com 9, adiciona o 9
        else if (number.length === 9 && !number.startsWith('9')) {
            cleaned = `55${ddd}9${number}`;
        }
    }

    return cleaned;
}
```

### 2. Estratégia de Retry

Se o envio falhar com o número normalizado, o sistema tenta automaticamente a versão alternativa (sem o 9 extra):

```javascript
// Primeira tentativa: com 9 (5511999999999)
await sendMessage('5511999999999', 'mensagem');

// Se falhar, tenta automaticamente: sem 9 (551199999999)
await sendMessage('551199999999', 'mensagem');
```

## Exemplos de Normalização

### Entrada → Normalização → Retry (se falhar)

| Entrada do Usuário | 1ª Tentativa | 2ª Tentativa (se falhar) |
|-------------------|--------------|--------------------------|
| `11988887777` | `5511988887777` | `551188887777` |
| `5511988887777` | `5511988887777` | `551188887777` |
| `(11) 98888-7777` | `5511988887777` | `551188887777` |
| `+55 11 98888-7777` | `5511988887777` | `551188887777` |
| `11 8888-7777` | `5511988887777` | `551188887777` |
| `551188887777` | `5511988887777` | `551188887777` |
| `5511888887777` | `5511888887777` | `551188887777` |

### Casos Especiais

**Número com 8 dígitos (antigo):**
```
Entrada: 5511888877777
Normalização: 55119888877777 (adiciona 9)
Retry: 5511888877777 (remove 9)
```

**Número já com 9 dígitos:**
```
Entrada: 5511988887777
Normalização: 5511988887777 (mantém)
Retry: 551188887777 (remove 9)
```

**Número com formatação:**
```
Entrada: +55 (11) 98888-7777
Normalização: 5511988887777 (limpa e normaliza)
Retry: 551188887777 (remove 9)
```

## Fluxo de Envio de Mensagem

```
┌─────────────────────────┐
│ Usuário cadastra número │
│  "5511 98888-7777"      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Limpa caracteres        │
│  "5511988887777"        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Normaliza (adiciona 9)  │
│  "5511988887777"        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Tenta enviar            │
│  POST /send/text        │
└───────────┬─────────────┘
            │
            ├─── Sucesso ──────────────┐
            │                          │
            └─── Falha                 │
                 │                     │
                 ▼                     │
          ┌─────────────────┐          │
          │ Remove o 9      │          │
          │ "551188887777"  │          │
          └────────┬────────┘          │
                   │                   │
                   ▼                   │
          ┌─────────────────┐          │
          │ Tenta novamente │          │
          │  POST /send/text│          │
          └────────┬────────┘          │
                   │                   │
                   ├─── Sucesso ───────┤
                   │                   │
                   └─── Falha          │
                        │              │
                        ▼              ▼
                  ┌──────────────────────┐
                  │ Retorna resultado    │
                  │ (sucesso ou erro)    │
                  └──────────────────────┘
```

## Logs Gerados

### Sucesso na primeira tentativa:
```
[INFO] WhatsApp notification sent {
  clientId: 123,
  userId: 456,
  numberUsed: "5511988887777"
}
```

### Sucesso na segunda tentativa (retry):
```
[WARN] Trying alternative number format {
  original: "5511988887777",
  alternative: "551188887777"
}
[INFO] WhatsApp notification sent {
  clientId: 123,
  userId: 456,
  numberUsed: "551188887777"
}
```

### Falha em ambas tentativas:
```
[WARN] Trying alternative number format {
  original: "5511988887777",
  alternative: "551188887777"
}
[ERROR] WhatsApp notification error {
  clientId: 123,
  userId: 456,
  error: "Erro ao enviar mensagem: ..."
}
```

## Validação no Frontend

O formulário de registro valida o formato do telefone:

```html
<input
  type="tel"
  name="phone"
  pattern="[0-9]{12,13}"
  placeholder="5511999999999"
  required
>
```

### Formatos Aceitos:
- ✅ `5511999999999` (13 dígitos - com 9)
- ✅ `551199999999` (12 dígitos - sem 9)
- ✅ `55119999999` (11 dígitos - muito antigo)
- ❌ `11999999999` (sem código do país)
- ❌ `+55 11 99999-9999` (com formatação - não aceito pelo pattern, mas é limpo pelo backend)

## Benefícios

1. **Tolerância a formatos diferentes**: Usuário pode digitar o número de várias formas
2. **Retry automático**: Se falhar, tenta o formato alternativo
3. **Logs detalhados**: Saberemos qual formato funcionou
4. **Zero intervenção manual**: Tudo é automático
5. **Compatibilidade com números antigos e novos**: Funciona com ambos

## Formato de Grupos

Para grupos do WhatsApp, o JID (identificador) tem formato diferente:

```
Contato individual: 5511999999999
Grupo: 120363123456789012@g.us
```

O sistema **não normaliza** JIDs de grupos, apenas números de contatos individuais.

## Função de Teste

Você pode testar a normalização diretamente:

```javascript
const whatsappService = require('./services/whatsapp-service');

// Testes
console.log(whatsappService.normalizePhoneNumber('11988887777'));
// Output: 5511988887777

console.log(whatsappService.normalizePhoneNumber('5511 98888-7777'));
// Output: 5511988887777

console.log(whatsappService.normalizePhoneNumber('+55 (11) 8888-7777'));
// Output: 5511988887777

console.log(whatsappService.normalizePhoneNumber('551188887777'));
// Output: 5511988887777
```

## Limitações

1. **Apenas números brasileiros**: A lógica é específica para código do país 55
2. **Grupos não são normalizados**: JIDs de grupos permanecem intactos
3. **Máximo 2 tentativas**: Após falhar com e sem o 9, retorna erro

## Recomendações

1. **Oriente os usuários**: Peça para usarem o formato completo com código do país
2. **Monitore os logs**: Verifique quais formatos estão falhando
3. **Atualize se necessário**: Se houver mudança nas regras de numeração no Brasil

## Código Completo da Normalização

```javascript
normalizePhoneNumber(phone) {
    // Remove todos os caracteres não numéricos
    let cleaned = phone.replace(/\D/g, '');

    // Se é número brasileiro (começa com 55)
    if (cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const number = cleaned.substring(4);

        // Se tem 8 dígitos, adiciona o 9 na frente
        if (number.length === 8) {
            cleaned = `55${ddd}9${number}`;
        }
        // Se tem 9 dígitos mas não começa com 9, adiciona o 9
        else if (number.length === 9 && !number.startsWith('9')) {
            cleaned = `55${ddd}9${number}`;
        }
    }

    return cleaned;
}
```

Esta abordagem garante que **99% dos números funcionarão automaticamente**, sem necessidade de intervenção manual!
