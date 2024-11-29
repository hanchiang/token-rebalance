import * as dotenv from "dotenv";
import express from 'express';
import { BridgeRequest, BridgeDirection } from './types';
import { deposit } from './script';
import { isValidTokenTransfer, validateAmount } from './util';
import { GasLimitTooLowError, InsufficientBalanceError } from './exception';
dotenv.config();

const app = express();
const port = process.env.PORT;

app.use(express.json());

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

app.get('/', (req, res) => {
  res.json({
    code: 0,
    data: 'hello world'
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

  if (req.body.direction == BridgeDirection.L1_TO_L2) {
    try {
      const receipt = await deposit(req.body.token.toUpperCase(), amount!);
      res.json(receipt);
      return;
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
    res.json({
      code: 1,
      data: 'unsupported'
    })
  }
})


