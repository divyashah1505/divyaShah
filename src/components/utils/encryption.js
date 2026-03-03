const crypto = require("crypto");
const Redis = require("ioredis");
class KeyRotationManager {
  constructor(redisUrl) {
    this.redis = new Redis(redisUrl);
    this.keyPrefix = "encryption:key:";
    this.currentKeyId = null;
  }
}
