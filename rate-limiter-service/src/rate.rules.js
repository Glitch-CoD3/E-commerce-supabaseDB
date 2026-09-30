const rateRules = {
    default:         { capacity: 10, refillRate: 2 },
    auth:            { capacity: 5,  refillRate: 0.1 },
    product:         { capacity: 20, refillRate: 5 },
    brand:           { capacity: 15, refillRate: 3 },
    category:        { capacity: 15, refillRate: 3 },
    productVariant:  { capacity: 20, refillRate: 5 },
    variantImage:    { capacity: 20, refillRate: 5 },
    cart:            { capacity: 15, refillRate: 3 },
    order:           { capacity: 10, refillRate: 2 },
    shippingAddress: { capacity: 10, refillRate: 1 },
    payment:         { capacity: 3,  refillRate: 0.5 },
};

export default rateRules;