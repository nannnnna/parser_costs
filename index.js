const axios = require("axios");
const BigNumber = require("bignumber.js");
const crypto = require("crypto");

const id_key = __dirname.split("/").slice(-1)[0];

class Bybit {
  constructor(config, options) {
    this.id_key = id_key;

    // Сохраняем amount и orderNum для каждого банка
    this.amountTCSBRUB = config.extra.amountTCSBRUB;
    this.orderNumTCSBRUB = config.extra.orderNumTCSBRUB;
    this.amountSBERRUB = config.extra.amountSBERRUB;
    this.orderNumSBERRUB = config.extra.orderNumSBERRUB;
    this.amountACRUB = config.extra.amountACRUB;
    this.orderNumACRUB = config.extra.orderNumACRUB;
    this.amountSBPRUB = config.extra.amountSBPRUB;
    this.orderNumSBPRUB = config.extra.orderNumSBPRUB;

    if (options.emitter) {
      this.emitter = options.emitter;
    } else if (options.callback) {
      this.callback = options.callback;
    } else {
      throw new Error(
        "Parser Bybit error constructor(options not found emitter or callback)"
      );
    }
  }

  async updateRate() {
    const rates_result = [];
    const paymentIds = [
      { id: "TCSBRUB", value: 581, amount: this.amountTCSBRUB, orderNum: this.orderNumTCSBRUB },
      { id: "SBERRUB", value: 582, amount: this.amountSBERRUB, orderNum: this.orderNumSBERRUB },
      { id: "ACRUB", value: 583, amount: this.amountACRUB, orderNum: this.orderNumACRUB },
      { id: "SBPRUB", value: 382, amount: this.amountSBPRUB, orderNum: this.orderNumSBPRUB }
    ];

    for (const payment of paymentIds) {
      const paymentValue = payment.value.toString();
      
      // Выполняем отдельный запрос для каждого payment с соответствующими amount и orderNum
      const symbolRates = await this.ApiRequestRate(paymentValue, payment.amount, payment.orderNum);
      console.log(paymentValue, payment.amount, payment.orderNum);
      const paymentToMap = Object.fromEntries(paymentIds.map(payment => [payment.value, payment.id]));

      if (!symbolRates || !symbolRates.result || !symbolRates.result.items || symbolRates.error_code === '500') continue;

      const filteredItems = symbolRates.result.items.filter(item => 
          item.isOnline === true && item.orderNum >= payment.orderNum
      );

      const rate = filteredItems.find(item => 
          item.payments && item.payments.toString() === paymentValue
      );

      if (rate) {
        console.log("Bybit p2p -> Price:", rate.price, paymentToMap[rate.payments])

          const inverse = new BigNumber(1);
          const ask = new BigNumber(rate.price);

          const r1 = {
              from: "USDTRC20",
              to: paymentToMap[rate.payments],
              buy: ask.toString(),
          };

          const r2 = {
              from: paymentToMap[rate.payments],
              to: "USDTRC20",
              buy: inverse.div(ask).toString(),
          };

          if (this.emitter) {
              this.emitter.emit("updateRate", this.id_key, r1);
              this.emitter.emit("updateRate", this.id_key, r2);
              console.info('Updated data by emitter -> bybit p2p')
          } else if (this.callback) {
              this.callback("updateRate", this.id_key, r1);
              this.callback("updateRate", this.id_key, r2);
              console.info('Updated data by callback -> bybit p2p')
          }

          rates_result.push(r1, r2);
      }
    }

    return rates_result;
  }

  ApiRequestRate(paymentValue, amount, orderNum) {
    const requestBody = {
        userId: 1337,
        tokenId: "USDT",
        currencyId: "RUB",
        payment: [paymentValue],
        side: "0",
        size: "100",
        page: "1",
        amount: amount.toString(), // Используем amount из конфигурации
        authMaker: true,
        canTrade: false,
        itemRegion: 2
    };

    return axios
        .post('https://api2.bybit.com/fiat/otc/item/online', requestBody, {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        })
        .then((res) => res.data)
        .catch((err) =>
            console.error("{Parser} Bybit -> Error fetching rate : ", err)
        );
  }
}

module.exports = Bybit;
