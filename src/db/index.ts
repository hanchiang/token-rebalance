​import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database;
export const initDb = () => {
    db = new Database(path.join(__dirname, 'db.sqlite'));
    db.exec(fs.readFileSync(__dirname + '/transaction.sql').toString());
}

export const getDb = () => db;

export interface TransactionDetail {
    id: number;
    tx: string;
    status: number;
}