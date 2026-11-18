-- Author:		Bruno Ohiro
-- Create date: 08/01/2014
-- Description:	Selects a list of addresses
-- =============================================
CREATE PROCEDURE [dbo].[SubscriptionUpdate]
           @PersonId int
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

   UPDATE [dbo].[Subscription]
   SET [IsActive] = 0
   WHERE PersonId = @PersonId
END



