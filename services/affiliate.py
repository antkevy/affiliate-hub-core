"""
Mercado Livre Affiliate Link Generator Service (Python Integration)

Este módulo fornece uma interface simples para Bots do Telegram e scripts Python
gerarem links de afiliados do Mercado Livre através da Edge Function do Supabase.
"""

import os
import requests
from typing import Optional


class AffiliateSessionExpiredError(Exception):
    """Exceção lançada quando a sessão de cookies da plataforma expirou."""
    pass


class AffiliateGenerationError(Exception):
    """Exceção genérica para falhas na geração do link de afiliado."""
    pass


def get_affiliate_link(
    product_url: str,
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
    platform: str = "mercadolivre"
) -> str:
    """
    Gera um link de afiliado do Mercado Livre chamando a Edge Function do Supabase.

    Args:
        product_url: URL original do produto no Mercado Livre.
        supabase_url: URL do projeto Supabase (opcional, padrão lê os.getenv("SUPABASE_URL")).
        supabase_key: Anon Key ou Service Role Key (opcional, padrão lê os.getenv("SUPABASE_ANON_KEY") ou SUPABASE_SERVICE_ROLE_KEY).
        platform: Identificador da plataforma (padrão: 'mercadolivre').

    Returns:
        str: URL encurtada do link de afiliado.

    Raises:
        AffiliateSessionExpiredError: Se os cookies da sessão no Supabase expiraram.
        AffiliateGenerationError: Se ocorrer erro na validação ou geração do link.
    """
    url = supabase_url or os.getenv("SUPABASE_URL", "")
    key = (
        supabase_key
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY", "")
    )

    if not url or not key:
        raise AffiliateGenerationError(
            "SUPABASE_URL e SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY devem ser informados ou configurados nas variáveis de ambiente."
        )

    # Remover barra final da URL se houver e montar o endpoint da Edge Function
    base_url = url.rstrip("/")
    endpoint = f"{base_url}/functions/v1/generate-affiliate-link"

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    payload = {
        "url": product_url,
        "platform": platform,
    }

    try:
        response = requests.post(endpoint, json=payload, headers=headers, timeout=30)
    except requests.exceptions.RequestException as err:
        raise AffiliateGenerationError(f"Falha de conexão com a Edge Function do Supabase: {err}") from err

    try:
        data = response.json()
    except ValueError:
        raise AffiliateGenerationError(
            f"Resposta inválida da Edge Function (HTTP {response.status_code}): {response.text}"
        )

    # Tratar erros de autenticação / sessão expirada (401/403 ou SESSION_EXPIRED)
    if response.status_code in (401, 403) or data.get("code") == "SESSION_EXPIRED":
        error_msg = data.get(
            "error",
            "A sessão do Mercado Livre expirou. Atualize os cookies no painel do administrador."
        )
        raise AffiliateSessionExpiredError(f"⚠️ {error_msg}")

    # Tratar outros erros HTTP ou retornos de erro da função
    if response.status_code != 200 or not data.get("success"):
        error_msg = data.get("error", f"Erro HTTP {response.status_code}")
        raise AffiliateGenerationError(f"Erro ao gerar link de afiliado: {error_msg}")

    affiliate_url = data.get("affiliate_url")
    if not affiliate_url:
        raise AffiliateGenerationError("A Edge Function não retornou a URL de afiliado.")

    return affiliate_url


# Exemplo de uso para execução direta
if __name__ == "__main__":
    import sys

    sample_url = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "https://produto.mercadolivre.com.br/MLB-3568912345-smartphone-exemplo"
    )

    print(f"🔗 Testando geração de link de afiliado para: {sample_url}")
    try:
        affiliate_link = get_affiliate_link(sample_url)
        print(f"✅ Link de Afiliado Gerado: {affiliate_link}")
    except AffiliateSessionExpiredError as e:
        print(f"🚨 ALERTA ADMINISTRATIVO: {e}")
    except Exception as e:
        print(f"❌ Erro: {e}")
