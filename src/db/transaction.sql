CREATE TABLE IF NOT EXISTS transaction_detail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx VARCHAR(64) NOT NULL,
    direction INTEGER NOT NULL,
    status INTEGER DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx ON transaction_detail(tx);
