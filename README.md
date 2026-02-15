# `cloud-run-cleanup`

Cleans up old Cloud Run revisions and their Docker images.

```
npm install -g cloud-run-cleanup
npx cloud-run-cleanup
```

I use Google Cloud Run for some of my projects: it's very easy to deploy the whole service or website and it works perfectly,
until your traffic reaches a point when it's actually cheaper to get a proper hosting, because it will be much cheaper.

But that moment might never happen for you regular hobby project, so Cloud Run is cool, right?

The only problem here is that when you deploy a new revision, the old revision and its Docker image is stored, and those Docker
images for old revisions are counted against the storage you use. So, it's tempting to delete them; and why do it manually?

No LLM code here, only organic human written code! I wrote it before LLM agents became a thing :)

## Usage

Authenticate (once):

```
gcloud config set project <your-project>
gcloud auth application-default login
```

Then run the script after each deployment, when you are ready to delete older revisions of all Cloud Run services:

```
npx cloud-run-cleanup
```

## Author

Alexander Fenster
