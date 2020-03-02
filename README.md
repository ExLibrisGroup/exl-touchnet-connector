# Ex Libris Touchnet Connector
This connector enables libraries from universities that use [Touchnet](https://www.touchnet.com/en) payment services to accept payment of fines and fees. The university can set up a link to the connector in the discovery system. When the patron clicks on the "Pay Fines" link, the conenctor will set up the payment and direct the patron to Touchnet to pay. Successfully completed payments are posted to the patron's account in Alma.

## Overview
This connector performs the following tasks:
* Set up the payment in Touchnet and redirect to the Touchnet site for payment
* Receive the response from Touchnet and post the payment to Alma
* Redirect the user back to Primo

![EXL Touchnet Connector Flow](https://i.postimg.cc/R04xpMGJ/exl-touchnet-flow.png)

*No PCI* information is handled by the connector. All of the payment information is entered only in the Touchnet site.

## Configuring the Connector
In order to use the connector, you need to coordinate with Touchnet customer service. They will provide the following two pieces of information:
* uPay Site ID, stored in the `UPAY_SITE_ID` environment variable
* uPay Site URL, stored in the `UPAY_SITE_URL` environment variable

In addition, you'll need an API key for Alma. Instructions for obtaining an API key are available at the [Ex Libris Developer Network](https://developers.exlibrisgroup.com/alma/apis). The API key should include read/write permissions for "users". The API key is stored in the `ALMA_APIKEY` environment variable.

### Deploying to Heroku
One easy way to deploy the connector is to use the [Heroku platform](https://heroku.com). Heroku has free plans (which could be appropriate depending on the level of usage) or very reasonable "hobby" plans. To deploy to Heroku, gather the parameters specified above and then click on the link below to sign up and deploy the connector. At the end of the process, Heroku will provide the URL for your connector. Use it to configure Primo in the following section.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

### Deploying to AWS
Another option for deploying the connector is to use Amazon Web Services (AWS). AWS has starter and free tiers which make hosting the connector nearly free. To deploy to AWS, log into your account (or create a new one). Then follow the instructions below.

1. Click on [this link](https://console.aws.amazon.com/cloudformation/home?#/stacks/create/review?templateURL=https://almad-test.s3.amazonaws.com/scratch/exl-touchnet-connector/template.yaml&stackName=ExlTouchnetConnector) to open the AWS console.
1. Fill in the specified parameters and check off the boxes in the *Capabilities and transforms* section and then click the *Create stack* button
1. AWS will create the necessary components. When it's complete, the stack will be in the *CREATE_COMPLETE* state. Click the *Outputs* tab to view the URL for the connector. You will use the URL to configure Primo in the following section.

## Configuration in Primo
To add the "Pay Fines" link to Primo, follow the instructions in this [online help entry](https://knowledge.exlibrisgroup.com/Primo/Product_Documentation/020Primo_VE/Library_Card_Configuration/Configuring_the_Pay_Fine_Link_for_Primo_VE). Be sure to include a `?` at the end of the URL. For example, if your Heroku URL is `https://exl-touchnet-connector-myuni.herokuapps.com`, configure the following in Primo: `https://exl-touchnet-connector-myuni.herokuapps.com/touchnet?`.

![Primo](https://i.postimg.cc/CK7TWW6P/exl-touchnet-primo.png)
