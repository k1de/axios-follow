# axios-follow

**Axios wrapper with automatic redirect following and cookie management.**

## Installation

```bash
npm install axios-follow
```

## Usage

### Using `addFollowMethod`

```javascript
import axios from 'axios'
import { addFollowMethod } from 'axios-follow'

const client = addFollowMethod(axios.create())
const response = await client.follow({ url: '...' })

console.log(response.followChain) // Redirect history
console.log(response.cookies) // Cookies by domain
```

### Using `axiosFollow` directly

```typescript
import axios from 'axios'
import { axiosFollow } from 'axios-follow'

const response = await axiosFollow(axios, { url: 'https://example.com' }, { maxRedirects: 5 })

console.log(response.followChain) // See all steps
console.log(response.cookies) // All cookies collected
```

> **Tip:** For cookie conversion/manipulation, use [cookie-more](https://github.com/k1de/cookie-more)

## Features

-   Automatic redirect following
-   Cookie management between requests
-   Complete redirect history
-   Compatible with standard Axios API

🚀 **Just add the `follow` method to your Axios client!**
