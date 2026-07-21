# n8n workflow release requirements

These files are source exports, not deployment-ready secrets or configuration. Import them inactive, rebind credentials in n8n, and test against non-production sheets and email accounts first.

## Retell webhook

`Retell - Receive_Call_Result v4.json` previously routed from an active node named `Webhook1` while downstream expressions read a disabled node named `Webhook`. The export now uses `Webhook` for the connected node and is deliberately inactive.

Do not activate it until all of the following are complete:

1. Rotate both exported webhook paths and update Retell to the new endpoint.
2. Verify Retell's `X-Retell-Signature` against the raw request body and the designated Retell webhook key before n8n processes the event. JSON re-serialization is not valid for this verification. Put the n8n webhook behind a small verification endpoint if the n8n deployment cannot preserve and verify the raw body.
3. Add persistent idempotency using `event + call.call_id`; Retell retries failed or slow webhook deliveries, and an in-memory deduplication key is not enough.
4. Reject missing `po_line_key`, `client_code`, `follow_up_stage`, unexpected call numbers, and metadata that does not match the sheet row before any update node runs.
5. Configure the webhook to acknowledge quickly and move slow classification work to a queued/sub-workflow execution.

## Email and approval workflows

- Approval recipients now come from `client_buyer_email`; validate that this field is present and belongs to the same client before sending.
- Replace pinned inputs with synthetic `example.com` data or clear pin data before committing future exports.
- Credential IDs and names in exports are references, not usable secrets, but they still reveal internal account structure. Rebind them after import and never export credential values.
- Use test/draft mode by default. A production workflow should require an explicit client-level send-mode setting and an auditable approval path.
- Add workflow error handlers, retry limits, and an alert destination for failed sheet writes, email sends, and model parsing.

Webhook keys, OAuth credentials, model keys, Google document IDs, and email addresses that appeared in prior commits must be rotated or reviewed. Deleting them from the latest tree is not sufficient.
