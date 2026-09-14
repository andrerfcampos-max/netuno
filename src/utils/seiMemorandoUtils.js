import { getRARoman, normalizeRAName } from './raList.js';

/**
 * Gera o texto exato do corpo do Memorando SEI (com minuta de ofício acoplada)
 * para encaminhamento ao Comandante do GPCIU referente a vistorias de hidrantes.
 * 
 * Observação institucional: O cabeçalho (Governo do DF / CBMDF / SUOMA / Numeração)
 * e o rodapé com assinatura eletrônica são gerados nativamente pelo sistema SEI.
 */
export const generateSeiMemorandoMinutaText = ({
  cidade,
  raRomano,
  ano = new Date().getFullYear(),
  numeroSeiRelatorio = ''
}) => {
  const nomeCidade = cidade || 'Distrito Federal';
  const romano = raRomano || getRARoman(nomeCidade);
  const raSufixo = romano ? `(RA ${romano})` : '';
  const cidadeUpper = nomeCidade.toUpperCase();
  const docRef = numeroSeiRelatorio && numeroSeiRelatorio.trim() !== '' 
    ? numeroSeiRelatorio.trim() 
    : '[Nº SEI DO RELATÓRIO EXTERNO]';

  return `Para: Maj. QOBM/Comb. Comandante do Grupamento de Prevenção e Combate a Incêndio Urbano (GPCIU)
Assunto: Vistoria de Hidrante em ${nomeCidade} ${raSufixo}

Senhor(a) Comandante,

1.     Informo a Vossa Senhoria que esta Seção de Hidrantes Urbanos procedeu às devidas vistorias anuais em ${nomeCidade} ${raSufixo}.
2.     Conforme registrado no Relatório de Vistoria da Fiscalização (${docRef}), constatou-se que os hidrantes encontram-se com alterações, apresentando avarias estruturais e demandando manutenção corretiva imediata por parte da CAESB conforme previsto no Acordo de Cooperação Técnica CAESB/CBMDF.
3.     Dessa forma, submeto o expediente à apreciação de Vossa Senhoria para conhecimento e posterior encaminhamento de ofício para o ambiente SEI [CAESB/DP] (minuta de ofício em anexo).


**** Anexo - Minuta de ofício ao ambiente CAESB/DP ****

Ao Senhor Diretor de Operações e Manutenção - Companhia de Saneamento Ambiental do Distrito Federal - CAESB
Assunto: Solicitação de Manutenção Corretiva em Hidrante Urbano de Incêndio – ${romano ? `RA ${romano} ` : ''}${cidadeUpper} - ${ano}.
Referência: Relatório de Vistoria da Fiscalização (${docRef})

Senhor Diretor,

Cumprimentando-o cordialmente, dirijo-me a Vossa Senhoria para solicitar a atenção dessa Companhia quanto à premente necessidade de manutenção corretiva e/ou substituição de aparelho na rede de hidrantes urbanos de incêndio instalados na Região Administrativa de ${nomeCidade} ${raSufixo}.

Durante vistoria técnica, constatou-se que os hidrantes situados em ${nomeCidade}, encontram-se com avarias e necessidade de manutenção corretiva imediata.

A plena funcionalidade do referido dispositivo é indispensável para garantir o suprimento ininterrupto e célere de água às viaturas operacionais em caso de sinistros, sendo medida crucial para a salvaguarda de vidas e proteção ao patrimônio na localidade.

Dessa forma, solicito os valorosos préstimos dessa Companhia para a adoção das providências necessárias visando a regularização dos componentes. O Relatório de Vistoria da Fiscalização (${docRef}) segue com as informações pertinentes para subsidiar as equipes técnicas em campo.

Renovo, na oportunidade, os protestos de elevada estima e consideração institucional.

Atenciosamente,`;
};
