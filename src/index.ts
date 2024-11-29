import * as dotenv from "dotenv";
import express from 'express';
import { BridgeRequest, BridgeDirection } from './types';
import { deposit, listenToDepositFinalise, getTx } from './script';
import { isValidTokenTransfer, validateAmount } from './util';
import { GasLimitTooLowError, InsufficientBalanceError } from './exception';
import { isValidName } from "ethers/lib/utils";
import { symbolToAddress, SENDER_ADDRESS } from './config';
import { initDb, getDb } from './db/index';
dotenv.config();

const app = express();
const port = process.env.PORT;

app.use(express.json());

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
  initDb();
});

app.get('/', (req, res) => {
  getDb().all('select * from transaction_detail', (_, _res) => {
    res.json({
      code: 0,
      data: _res
    })
  })
  
});

app.post('/bridge', async (req: express.Request<any, any, BridgeRequest>, res) => {
  if (!(req.body.direction in BridgeDirection)) {
    console.log('invalid direction');
    res.json({
      code: 1,
      data: 'invalid direction'
    })
    return;
  }

  if (!isValidTokenTransfer(req.body.token, req.body.direction)) {
    console.log('invalid token transfer');
    res.json({
      code: 1,
      data: 'invalid token'
    })
    return;
  }

  const amount = validateAmount(req.body.amount);
  if (amount == null) {
    console.log('invalid amount');
    res.json({
      code: 1,
      data: 'invalid amount'
    })
    return;
  }

  let to = req.body.to;
  if (req.body.to != null && isValidName(req.body.to)) {
    to = req.body.to;
  }

  if (req.body.direction == BridgeDirection.L1_TO_L2) {
    try {
      const tokenAddress = symbolToAddress[BridgeDirection.L1_TO_L2][req.body.token.toUpperCase()];
      const toAddress = (to || SENDER_ADDRESS)!;
      const response = await deposit(tokenAddress, amount!, toAddress!);
      res.json(response);
      await listenToDepositFinalise(tokenAddress, to!, amount, response.hash);
    } catch(error) {
      console.log(error);
      if (error instanceof InsufficientBalanceError || error instanceof GasLimitTooLowError) {
        res.json({
          code: 1,
          data: error.message
        });
      } else {
        res.json({
          code: 1,
          data: 'error'
        });
      }
      return;
    }
  } else {
    // withdraw not working
    res.json({
      code: 1,
      data: 'unsupported'
    })
  }
})


app.get('/tx/:tx', async (req: express.Request<{[key in 'tx']: string}>, res) => {
  const tx = req.params.tx;
  const receipt = await getTx(tx);
  res.json({
    code: 0,
    data: receipt
  })
  
})