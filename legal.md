DATA STORAGE, RETRIEVAL, AND ACCOUNT TERMINATION AGREEMENT

This Data Storage, Retrieval, and Account Termination Agreement (the "Agreement") governs the terms under which Nature Commons Ltd, trading as Listening Lab (the "Company"), provides data infrastructure, analytics, and storage services to you (the "Client").

By clicking "I Agree" and proceeding to use the platform, you acknowledge that cloud data transfer and storage operations incur structural infrastructure costs from third-party cloud providers (Google Cloud Platform), and you agree to the financial terms outlined herein regarding data retrieval, account suspension, and account termination.

1. Data Ownership
   The Client retains 100% ownership, intellectual property rights, and title to all acoustic recordings, metadata, and files uploaded to or analyzed by the Company's platform. The Company claims no ownership over Client data.

2. Operational Models & Dynamic Cloud Pricing
   The Client must select or operate under one of the two following infrastructure models. The financial obligations for data egress (downloading) and deletion depend entirely on the model used.
   Dynamic Pricing Acknowledgment: The Client acknowledges that third-party cloud infrastructure fees fluctuate over time. The specific per-gigabyte rates listed below serve as baseline estimations. In all circumstances, the Client will be billed at-cost according to the cloud provider's active, public rates at the exact time the operational event (such as data retrieval or deletion) occurs.

MODEL A: COMPANY-HOSTED STORAGE
Applies if the Company stores the Client’s acoustic recordings within the Company’s cloud infrastructure.Audio Compression Standard: To minimize storage and retrieval costs, the platform utilizes FLAC (Free Lossless Audio Codec) as its default compression standard. This preserves 100% of the acoustic integrity required for specialized bat, marine, and avian bioacoustic analysis while reducing file sizes.
Data Retrieval (Network Egress) Fees: Downloading or exporting acoustic recordings from the platform—whether during active operations or upon account closure—incurs third-party network egress fees. The Company passes these costs directly to the Client at-cost, with no markup.

Network transit baseline estimation is currently $0.12 per Gigabyte (GB) downloaded.
Early Deletion Fees (Minimum Retention): To minimize monthly hosting costs, acoustic files are stored in a long-term "Coldline" storage tier which enforces a 90-day minimum retention period per file by the underlying cloud provider.

If the Client deletes files or terminates their account less than 90 days after an upload occurs, the Client agrees to pay the pro-rated remainder of that 90-day storage window based on active cloud penalty rates (baseline estimation is currently $0.007 per GB per month).

MODEL B: CLIENT-MANAGED STORAGE (Bring Your Own Bucket - BYOB)
Applies if the Client maintains their own Google Cloud Storage (GCS) buckets and grants the Company secure analytical access.

Infrastructure Costs: The Client is directly responsible for all storage, deletion, and egress costs generated inside their own cloud account. The Company will never bill the Client for media storage or media egress under this model.Regional Configuration Requirement: To eliminate cross-region data transfer fees, the Client must configure their GCS bucket to reside in the same Google Cloud region as the Company’s analytics infrastructure (Current Region: australia-southeast1).

Failure to match regions may cause the third-party cloud provider to bill the Client directly for cross-region data reads during analysis.

3. Overdue Invoices and Account Suspension
   If an invoice for the platform's services or pass-through cloud infrastructure costs becomes overdue:
   Immediate Suspension: The Client’s access to paid platform features, automated analytics, and data processing will be suspended immediately until the account balance is settled.
   30-Day Data Retention Grace Period: The Company will continue to safely host the Client's existing acoustic data for 30 calendar days following the suspension date.
   Data Purging: If the invoice remains unpaid after 30 consecutive days of account suspension, the Company reserves the right to permanently and irreversibly delete all hosted acoustic recordings and metadata associated with the account to prevent ongoing cloud maintenance fees. The Client remains liable for all unpaid balances incurred up to the date of deletion.

4. Account Termination & Voluntary Data Deletion
   Upon a formal request for account deletion initiated by a Client with no outstanding balances or overdue invoices:
   Structured Data: All database metadata, predictions, and analysis metrics stored in the Company's infrastructure will be erased completely and permanently at zero cost to the Client.
   Hosted Media Retrieval Window: For Model A (Hosted) clients wishing to retrieve their files before account closure, the Company will calculate the total volume of data to be exported. The Client must settle the calculated at-cost network egress fee before the final data export is initiated.Purging: Once data is successfully exported (or if the Client waives their right to retrieve copies), all hosted files will be permanently deleted from the Company's servers, and monthly storage billing will cease.

5. Client Acknowledgment & Consent
   By clicking the confirmation button below, you certify that you have read, understood, and agreed to this document. You assume financial responsibility for any network egress or early deletion penalties triggered by your data retrieval, account termination, or non-payment behavior as outlined above.
