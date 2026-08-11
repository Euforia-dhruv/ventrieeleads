"""Tests for the email service and notification dispatch task."""
import os
import pytest
from unittest.mock import MagicMock, patch

from worker.services.email import EmailService, email_service


class TestEmailService:
    def test_dev_mode_logs_and_returns_true(self):
        os.environ["SMTP_HOST"] = "localhost"
        service = EmailService()
        ok = service.send("test@example.com", "Hello", "Body")
        assert ok is True

    def test_missing_recipient_returns_false(self):
        service = EmailService()
        assert service.send("", "Subject", "Body") is False

    @pytest.mark.parametrize("config", [
        {"SMTP_HOST": "smtp.example.com", "SMTP_PORT": "587", "SMTP_USE_TLS": "true"},
        {"SMTP_HOST": "smtp.example.com", "SMTP_PORT": "465", "SMTP_USE_TLS": "false"},
    ])
    def test_send_smtp_success(self, config):
        for k, v in config.items():
            os.environ[k] = v
        service = EmailService()
        with patch("smtplib.SMTP") as mock_smtp:
            server = mock_smtp.return_value.__enter__.return_value
            ok = service.send("to@example.com", "Subj", "Body", html="<p>Body</p>")
            assert ok is True
            server.sendmail.assert_called_once()

    def test_send_smtp_failure_returns_false(self):
        os.environ["SMTP_HOST"] = "smtp.example.com"
        service = EmailService()
        with patch("smtplib.SMTP", side_effect=Exception("connection refused")):
            ok = service.send("to@example.com", "Subj", "Body")
            assert ok is False


class TestNotificationDispatch:
    def test_dispatch_pending_email_no_recipient_marks_failed(self):
        from worker.services.notification_dispatch import dispatch_pending_email

        db = MagicMock()
        db.execute.return_value.fetchone.return_value = None
        row = {
            "id": "11111111-1111-1111-1111-111111111111",
            "user_id": None,
            "title": "Hi",
            "body": "Body",
            "data": {},
        }
        dispatch_pending_email(db, row)
        params = [c.args[1] for c in db.execute.call_args_list if len(c.args) > 1]
        assert any(p.get("err") == "no recipient" for p in params if isinstance(p, dict))

    def test_dispatch_pending_email_sends_and_marks_delivered(self):
        from worker.services.notification_dispatch import dispatch_pending_email

        db = MagicMock()
        row = {
            "id": "22222222-2222-2222-2222-222222222222",
            "user_id": None,
            "title": "Hi",
            "body": "Body",
            "data": {"to": "lead@example.com"},
        }
        with patch("worker.services.email.email_service") as mock_email:
            mock_email.send.return_value = True
            dispatch_pending_email(db, row)
        mock_email.send.assert_called_once_with(
            to="lead@example.com", subject="Hi", body="Body", html=None, from_addr=None
        )
        calls = " ".join(str(c.args[0]) for c in db.execute.call_args_list)
        assert "delivered" in calls
        assert "sent_at" in calls

    def test_dispatch_pending_email_uses_user_fallback(self):
        from worker.services.notification_dispatch import dispatch_pending_email

        db = MagicMock()
        db.execute.return_value.fetchone.return_value = ("user@example.com",)
        row = {
            "id": "33333333-3333-3333-3333-333333333333",
            "user_id": "44444444-4444-4444-4444-444444444444",
            "title": "Hi",
            "body": "Body",
            "data": {},
        }
        with patch("worker.services.email.email_service") as mock_email:
            mock_email.send.return_value = True
            dispatch_pending_email(db, row)
        mock_email.send.assert_called_once()
        assert mock_email.send.call_args.kwargs["to"] == "user@example.com"

    def test_task_runs_and_returns_counts(self):
        from worker.services.notification_dispatch import fetch_pending_emails, mark_browser_delivered

        db = MagicMock()
        db.execute.return_value.mappings.return_value.all.return_value = []
        assert fetch_pending_emails(db, limit=5) == []

        db.execute.return_value.rowcount = 3
        assert mark_browser_delivered(db, limit=5) == 3
