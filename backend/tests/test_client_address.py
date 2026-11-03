from types import SimpleNamespace

from api.client_address import trusted_client_address


def request(headers=None, host="127.0.0.1"):
    return SimpleNamespace(
        headers=headers or {},
        client=SimpleNamespace(host=host) if host else None,
    )


def test_production_uses_edge_overwritten_client_ip(monkeypatch):
    monkeypatch.setattr(
        "api.client_address.settings",
        SimpleNamespace(environment="production"),
    )
    incoming = request(
        headers={
            "CF-Connecting-IP": "203.0.113.7",
            "X-Forwarded-For": "198.51.100.99",
        },
        host="198.51.100.99",
    )

    assert trusted_client_address(incoming) == "203.0.113.7"


def test_production_rejects_missing_or_invalid_edge_identity(monkeypatch):
    monkeypatch.setattr(
        "api.client_address.settings",
        SimpleNamespace(environment="production"),
    )

    assert trusted_client_address(request(headers={})) == "untrusted-render-client"
    assert trusted_client_address(
        request(headers={"CF-Connecting-IP": "forged-value"})
    ) == "untrusted-render-client"


def test_nonproduction_uses_direct_socket_peer(monkeypatch):
    monkeypatch.setattr(
        "api.client_address.settings",
        SimpleNamespace(environment="test"),
    )

    assert trusted_client_address(
        request(headers={"X-Forwarded-For": "198.51.100.99"})
    ) == "127.0.0.1"
